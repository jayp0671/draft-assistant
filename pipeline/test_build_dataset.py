import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import Mock, patch

MODULE_PATH = Path(__file__).with_name("build_dataset.py")
spec = importlib.util.spec_from_file_location("build_dataset", MODULE_PATH)
build_dataset = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build_dataset)


def valid_rows(count=120):
    rows = []
    positions = ["QB", "RB", "WR", "TE", "K", "DEF"]
    for i in range(count):
        pos = positions[i % len(positions)]
        # Plenty of season-scale skill projections so the validator can detect
        # an accidentally per-game/partial dataset without being overly strict.
        proj = 220.0 - (i % 40) if pos in {"QB", "RB", "WR", "TE"} else 110.0
        rows.append({
            "playerId": f"p{i}",
            "name": f"Player {i}",
            "position": pos,
            "team": "FA",
            "projPoints": proj,
            "adp": float(i + 1),
        })
    return rows


class FakeResponse:
    def __init__(self, payload, status_code=200):
        self._payload = payload
        self.status_code = status_code

    def raise_for_status(self):
        if self.status_code >= 400:
            raise build_dataset.requests.HTTPError(f"HTTP {self.status_code}")

    def json(self):
        return self._payload


class ProjectionTests(unittest.TestCase):
    def test_raw_stat_projection_is_never_multiplied_by_17(self):
        # 10 catches + 300 yards + 1 TD = 46 full-season fantasy points.
        row = {"rawStats": {"53": 10, "42": 300, "43": 1}, "espnProj": 20}
        self.assertEqual(build_dataset.resolve_espn_projection(row), 46.0)

    def test_low_season_applied_total_is_not_inflated(self):
        self.assertEqual(
            build_dataset.resolve_espn_projection({"rawStats": None, "espnProj": 46}),
            46.0,
        )

    def test_season_scale_applied_total_is_used_as_is(self):
        self.assertEqual(
            build_dataset.resolve_espn_projection({"rawStats": None, "espnProj": 285}),
            285.0,
        )

    def test_selects_season_projection_instead_of_first_weekly_projection(self):
        stats = [
            {"seasonId": build_dataset.SEASON, "statSourceId": 1, "statSplitTypeId": 1,
             "scoringPeriodId": 1, "appliedTotal": 20.0, "stats": {"53": 5}},
            {"seasonId": build_dataset.SEASON, "statSourceId": 1, "statSplitTypeId": 0,
             "scoringPeriodId": 0, "appliedTotal": 285.0, "stats": {"53": 80}},
        ]
        selected = build_dataset.select_espn_season_projection(stats)
        self.assertEqual(selected["appliedTotal"], 285.0)
        self.assertEqual(selected["statSplitTypeId"], 0)

    def test_weekly_only_projection_is_not_treated_as_season_total(self):
        stats = [
            {"seasonId": build_dataset.SEASON, "statSourceId": 1, "statSplitTypeId": 1,
             "scoringPeriodId": 1, "appliedTotal": 20.0},
        ]
        self.assertIsNone(build_dataset.select_espn_season_projection(stats))

    def test_missing_projection_is_zero(self):
        self.assertEqual(build_dataset.resolve_espn_projection({}), 0.0)


class FfcAdpTests(unittest.TestCase):
    @patch.object(build_dataset.requests, "get")
    def test_empty_current_year_does_not_silently_fetch_previous_year(self, get):
        get.return_value = FakeResponse({"players": []})
        result = build_dataset.fetch_ffc_adp()
        self.assertEqual(result, {})
        self.assertEqual(get.call_count, 1)
        self.assertEqual(get.call_args.kwargs["params"]["year"], build_dataset.SEASON)

    @patch.object(build_dataset.requests, "get")
    def test_current_year_ffc_values_are_used(self, get):
        get.return_value = FakeResponse({"players": [{"name": "Ja'Marr Chase", "adp": 2.5}]})
        result = build_dataset.fetch_ffc_adp()
        self.assertEqual(result["jamarr chase"], 2.5)
        self.assertEqual(get.call_count, 1)


class DatasetSafetyTests(unittest.TestCase):
    def test_empty_dataset_is_rejected(self):
        with self.assertRaises(ValueError):
            build_dataset.validate_dataset([])

    def test_small_partial_dataset_is_rejected(self):
        with self.assertRaises(ValueError):
            build_dataset.validate_dataset(valid_rows(20))

    def test_per_game_scale_dataset_is_rejected(self):
        rows = valid_rows()
        for row in rows:
            if row["position"] in {"QB", "RB", "WR", "TE"}:
                row["projPoints"] = 18.5
        with self.assertRaises(ValueError):
            build_dataset.validate_dataset(rows)

    def test_valid_dataset_passes(self):
        rows = valid_rows()
        self.assertIs(build_dataset.validate_dataset(rows), rows)

    def test_invalid_write_preserves_existing_snapshot(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "players.json"
            original = [{"sentinel": "last-known-good"}]
            path.write_text(json.dumps(original), encoding="utf-8")
            with self.assertRaises(ValueError):
                build_dataset.write_dataset_atomic([], path)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), original)

    def test_valid_write_atomically_replaces_snapshot(self):
        with tempfile.TemporaryDirectory() as td:
            path = Path(td) / "players.json"
            path.write_text("[]", encoding="utf-8")
            rows = valid_rows()
            build_dataset.write_dataset_atomic(rows, path)
            self.assertEqual(json.loads(path.read_text(encoding="utf-8")), rows)
            self.assertFalse(path.with_suffix(".json.tmp").exists())

    def test_duplicate_player_id_is_rejected(self):
        rows = valid_rows()
        rows[1]["playerId"] = rows[0]["playerId"]
        with self.assertRaises(ValueError):
            build_dataset.validate_dataset(rows)


class UiRegressionTests(unittest.TestCase):
    def test_draft_board_does_not_render_literal_font_mono_text(self):
        # This catches the v2.0 regression where `font-mono` was accidentally
        # placed in JSX text content instead of the className.
        draft_board = Path(__file__).resolve().parents[1] / "web" / "src" / "components" / "DraftBoard.tsx"
        text = draft_board.read_text(encoding="utf-8")
        self.assertIn('className="font-mono text-xs', text)
        self.assertNotIn("font-mono {pk.round}", text)


if __name__ == "__main__":
    unittest.main(verbosity=2)
