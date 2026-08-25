#!/usr/bin/env python3
"""
Data Pipeline - Fiserv Goons Draft Assistant (Charter Section 6.2)

Sources:
  1. Sleeper API         -> master players, positions, teams, injury, depth chart (no key)
  2. nflreadpy/nflverse  -> historical volume, target share, games-missed, draft capital (no key)
  3. ESPN fantasy API    -> current-season projections + ADP (public, no key)
  4. FantasyPros API     -> expert consensus ranks/ADP backup (free key, RATE LIMITED 50/day)
  5. CollegeFootballData -> rookie college production (free key)
  6. shared/schedule     -> 2026 bye weeks (hardcoded, exact)

Produces one merged, LEAGUE-SCORED player table -> Supabase + local players.json.

Run:  python pipeline/build_dataset.py
Env:  .env with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY, FANTASYPROS_API_KEY
"""

import os
import json
import sys
import time
from pathlib import Path
import requests

try:
    from dotenv import load_dotenv
    load_dotenv(Path(__file__).resolve().parents[1] / ".env")
except Exception:
    pass

ROOT = Path(__file__).resolve().parents[1]
OUT_JSON = ROOT / "web" / "src" / "data" / "players.json"
OUT_JSON.parent.mkdir(parents=True, exist_ok=True)

SEASON = 2026
NUM_TEAMS = 12

# ---------------------------------------------------------------------------
# 2026 bye weeks - exact, from released schedule (mirror of shared/schedule.ts)
# ---------------------------------------------------------------------------
BYE_WEEKS_2026 = {
    "KC": 5, "CAR": 5,
    "MIA": 6, "CIN": 6, "DET": 6, "MIN": 6,
    "BUF": 7, "LAC": 7, "WAS": 7, "JAX": 7,
    "NYG": 8, "NO": 8, "SF": 8, "HOU": 8,
    "TEN": 9, "PIT": 9,
    "DEN": 10, "PHI": 10, "CHI": 10, "TB": 10,
    "NE": 11, "CLE": 11, "SEA": 11, "GB": 11, "ATL": 11, "LAR": 11,
    "IND": 13, "NYJ": 13, "LV": 13, "BAL": 13,
    "DAL": 14, "ARI": 14,
}

# ---------------------------------------------------------------------------
# Scoring - mirrors shared/league-config.ts SCORING (keep in sync)
# ---------------------------------------------------------------------------
SCORING = dict(
    passYardPoints=0.04, passTD=4, passTwoPt=2, interceptionThrown=-1,
    rushYardPoints=0.1, rushTD=6, rushTwoPt=2,
    reception=1, recYardPoints=0.1, recTD=6, recTwoPt=2,
    fumbleLost=-2,
    fg0to19=3, fg20to29=3, fg30to39=3, fg40to49=4, fg50to59=5, fg60plus=6,
    patMade=1, fgMissed=-1, patMissed=-1,
    defTD=6, defSack=1, defInt=2, defFumbleRecovery=2, defSafety=2,
    defForcedFumble=1, defBlockedKick=2,
    defPA0=10, defPA1to6=7, defPA7to13=4, defPA14to20=1,
    defPA21to27=0, defPA28to34=-1, defPA35plus=-4,
)


def log(msg):
    print(f"[pipeline] {msg}", flush=True)


# ---------------------------------------------------------------------------
# 1. Sleeper - master identity + injury + depth chart
# ---------------------------------------------------------------------------
def fetch_sleeper_players():
    log("Fetching Sleeper master player list...")
    r = requests.get("https://api.sleeper.app/v1/players/nfl", timeout=60)
    r.raise_for_status()
    data = r.json()
    players = {}
    for pid, p in data.items():
        pos = p.get("position")
        if pos not in ("QB", "RB", "WR", "TE", "K", "DEF"):
            continue
        if not p.get("active", True) and pos != "DEF":
            continue
        team = p.get("team") or "FA"
        players[pid] = {
            "playerId": pid,
            "name": p.get("full_name") or f"{p.get('first_name','')} {p.get('last_name','')}".strip(),
            "position": pos,
            "team": team,
            "injuryStatus": p.get("injury_status"),
            "isRookie": (p.get("years_exp") == 0),
            "byeWeek": BYE_WEEKS_2026.get(team.upper()),
            "depthChartOrder": p.get("depth_chart_order"),
            "searchName": (p.get("search_full_name") or "").lower(),
        }
    log(f"  -> {len(players)} fantasy-relevant players")
    return players


# ---------------------------------------------------------------------------
# 2. nflverse - target share, games-missed, draft capital
# ---------------------------------------------------------------------------
def fetch_nflverse_enrichment():
    log("Fetching nflverse enrichment (usage, durability, draft capital)...")
    out = {}
    try:
        import nflreadpy as nfl
    except ImportError:
        log("  nflreadpy not installed; skipping (pip install nflreadpy)")
        return out
    # ---- usage + target share + games missed (last 2 seasons) ----
    try:
        stats = nfl.load_player_stats([SEASON - 2, SEASON - 1]).to_pandas()
        team_targets = {}
        # precompute team-week target totals for share calc
        if "targets" in stats.columns:
            grp = stats.groupby(["season", "week", "recent_team"])["targets"].sum().to_dict()
            team_targets = grp
        for name, g in stats.groupby("player_display_name"):
            g = g.sort_values(["season", "week"])
            recent = g.tail(8)
            earlier = g.head(max(len(g) - 8, 1))
            trend = 0.0
            if "targets" in g.columns and earlier["targets"].mean() > 0:
                trend = float((recent["targets"].mean() - earlier["targets"].mean())
                              / (earlier["targets"].mean() + 1e-6))
                trend = max(-1.0, min(1.0, trend))
            # target share: player targets / team targets over last season
            tshare = None
            if "targets" in g.columns and "recent_team" in g.columns:
                last = g[g["season"] == SEASON - 1]
                if len(last):
                    pt = last["targets"].sum()
                    tt = 0
                    for _, row in last.iterrows():
                        tt += team_targets.get((row["season"], row["week"], row["recent_team"]), 0)
                    if tt > 0:
                        tshare = round(float(pt / tt), 3)
            # games missed: 17-game seasons minus games played
            gm = 0
            for season in (SEASON - 2, SEASON - 1):
                gp = len(g[g["season"] == season])
                gm += max(0, 17 - gp) if gp > 0 else 0
            out[name.lower()] = {
                "usageTrend": round(trend, 2),
                "targetShare": tshare,
                "gamesMissed2y": gm if gm > 0 else None,
            }
    except Exception as e:
        log(f"  usage/durability step failed ({e}); continuing")
    # ---- draft capital (rookies) ----
    try:
        picks = nfl.load_draft_picks().to_pandas()
        recent = picks[picks["season"] >= SEASON - 1]
        for _, row in recent.iterrows():
            nm = str(row.get("pfr_player_name") or row.get("player_name") or "").lower()
            if nm:
                out.setdefault(nm, {})
                out[nm]["draftRound"] = int(row["round"]) if row.get("round") else None
                out[nm]["draftPick"] = int(row["pick"]) if row.get("pick") else None
    except Exception as e:
        log(f"  draft-capital step failed ({e}); continuing")
    log(f"  -> enrichment for {len(out)} players")
    return out


# ---------------------------------------------------------------------------
# 3. ESPN - projections + ADP
# ---------------------------------------------------------------------------
def fetch_espn_projections():
    log("Fetching ESPN projections...")
    url = (f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/"
           f"{SEASON}/segments/0/leaguedefaults/3")
    params = {"view": "kona_player_info"}
    headers = {"x-fantasy-filter": json.dumps({"players": {
        "limit": 1200,
        "sortDraftRanks": {"sortPriority": 1, "sortAsc": True, "value": "PPR"},
    }})}
    proj = {}
    try:
        r = requests.get(url, params=params, headers=headers, timeout=60)
        r.raise_for_status()
        for item in r.json().get("players", []):
            pl = item.get("player", {})
            nm = normalize(pl.get("fullName", ""))
            adp = item.get("draftRanksByRankType", {}).get("PPR", {}).get("rank")
            stats = pl.get("stats", [])
            ps = next((s for s in stats if s.get("seasonId") == SEASON
                       and s.get("statSourceId") == 1), None)
            proj[nm] = {"adp": adp,
                        "espnProj": ps.get("appliedTotal") if ps else None,
                        "rawStats": ps.get("stats") if ps else None}
    except Exception as e:
        log(f"  ESPN fetch failed ({e}); ADP/proj will fall back")
    log(f"  -> projections for {len(proj)} players")
    return proj


# ---------------------------------------------------------------------------
# 4. FantasyPros - consensus ECR (RATE LIMITED - free key caps ~50 req/day)
# ---------------------------------------------------------------------------
def fetch_fantasypros():
    key = os.getenv("FANTASYPROS_API_KEY")
    if not key:
        log("  FANTASYPROS_API_KEY not set; skipping FP consensus")
        return {}
    log("Fetching FantasyPros consensus (rate-limited)...")
    out = {}
    headers = {"x-api-key": key}
    # ONE request per position = 6 total, well under the 50/day cap.
    positions = ["QB", "RB", "WR", "TE", "K", "DST"]
    for i, pos in enumerate(positions):
        try:
            r = requests.get(
                f"https://api.fantasypros.com/public/v2/json/nfl/{SEASON}/consensus-rankings",
                params={"position": pos, "scoring": "PPR"},
                headers=headers, timeout=30,
            )
            if r.status_code == 429:
                log("  FantasyPros rate limit hit (429). Stopping FP fetch; using what we have.")
                break
            r.raise_for_status()
            for pl in r.json().get("players", []):
                nm = normalize(pl.get("player_name", ""))
                out[nm] = {"fpEcr": pl.get("rank_ecr"), "fpTier": pl.get("tier")}
            time.sleep(1.2)  # gentle spacing to respect the cap
        except Exception as e:
            log(f"  FantasyPros {pos} failed ({e}); continuing")
    log(f"  -> FP consensus for {len(out)} players")
    return out


# ---------------------------------------------------------------------------
# 5. CollegeFootballData - rookie college production
# ---------------------------------------------------------------------------
def fetch_cfbd_rookies():
    key = os.getenv("CFBD_API_KEY")
    if not key:
        log("  CFBD_API_KEY not set; skipping rookie college stats")
        return {}
    log("Fetching CollegeFootballData rookie production...")
    rookies = {}
    try:
        headers = {"Authorization": f"Bearer {key}"}
        r = requests.get("https://api.collegefootballdata.com/stats/player/season",
                         params={"year": SEASON - 1}, headers=headers, timeout=60)
        r.raise_for_status()
        for row in r.json():
            nm = normalize(str(row.get("player", "")))
            rookies.setdefault(nm, {})[row.get("statType", "stat")] = row.get("stat")
    except Exception as e:
        log(f"  CFBD fetch failed ({e}); continuing")
    log(f"  -> college stats for {len(rookies)} players")
    return rookies


# ---------------------------------------------------------------------------
# Scoring from ESPN raw stat ids
# ---------------------------------------------------------------------------
ESPN_STAT_MAP = {
    "3": "passYards", "4": "passTD", "20": "passInt",
    "24": "rushYards", "25": "rushTD",
    "42": "recYards", "43": "recTD", "53": "receptions",
    "72": "fumblesLost",
}


def score_from_espn_raw(raw):
    if not raw:
        return None
    s = {ESPN_STAT_MAP[str(k)]: v for k, v in raw.items() if str(k) in ESPN_STAT_MAP}
    pts = 0.0
    pts += s.get("passYards", 0) * SCORING["passYardPoints"]
    pts += s.get("passTD", 0) * SCORING["passTD"]
    pts += s.get("passInt", 0) * SCORING["interceptionThrown"]
    pts += s.get("rushYards", 0) * SCORING["rushYardPoints"]
    pts += s.get("rushTD", 0) * SCORING["rushTD"]
    pts += s.get("receptions", 0) * SCORING["reception"]
    pts += s.get("recYards", 0) * SCORING["recYardPoints"]
    pts += s.get("recTD", 0) * SCORING["recTD"]
    pts += s.get("fumblesLost", 0) * SCORING["fumbleLost"]
    return round(pts, 1)


def normalize(nm):
    return (nm or "").lower().replace(".", "").replace("'", "").strip()


# ---------------------------------------------------------------------------
# Merge + write
# ---------------------------------------------------------------------------
def build():
    players = fetch_sleeper_players()
    enrich = fetch_nflverse_enrichment()
    espn = fetch_espn_projections()
    fp = fetch_fantasypros()
    rookies = fetch_cfbd_rookies()

    merged = []
    for pid, p in players.items():
        key = normalize(p["name"])
        e = espn.get(key, {})
        u = enrich.get(p["name"].lower(), {}) or enrich.get(key, {})
        f = fp.get(key, {})

        proj = score_from_espn_raw(e.get("rawStats"))
        if proj is None:
            proj = e.get("espnProj")
        if proj is None:
            proj = 0.0

        # ADP: prefer ESPN; fall back to FantasyPros ECR; else unranked
        adp = e.get("adp") or f.get("fpEcr") or 999

        merged.append({
            "playerId": pid, "name": p["name"], "position": p["position"],
            "team": p["team"], "projPoints": round(float(proj), 1), "adp": float(adp),
            "injuryStatus": p.get("injuryStatus"), "usageTrend": u.get("usageTrend", 0.0),
            "isRookie": p.get("isRookie", False), "byeWeek": p.get("byeWeek"),
            "playoffSos": None,
            "targetShare": u.get("targetShare"),
            "depthChartOrder": p.get("depthChartOrder"),
            "gamesMissed2y": u.get("gamesMissed2y"),
            "draftRound": u.get("draftRound"), "draftPick": u.get("draftPick"),
            "fpEcr": f.get("fpEcr"),
        })

    merged = [m for m in merged if m["projPoints"] > 0 or m["adp"] < 999
              or m["position"] in ("K", "DEF")]
    merged.sort(key=lambda x: (-x["projPoints"], x["adp"]))
    log(f"Merged dataset: {len(merged)} players")

    OUT_JSON.write_text(json.dumps(merged, indent=2))
    log(f"Wrote local fallback -> {OUT_JSON}")

    push_to_supabase(merged)
    return merged


def push_to_supabase(rows):
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        log("  SUPABASE_URL / SERVICE_ROLE not set; skipping upload (players.json still written)")
        return
    log("Uploading players to Supabase...")
    endpoint = f"{url}/rest/v1/players"
    headers = {"apikey": key, "Authorization": f"Bearer {key}",
               "Content-Type": "application/json",
               "Prefer": "resolution=merge-duplicates,return=minimal"}
    try:
        requests.delete(f"{endpoint}?player_id=neq.__none__", headers=headers, timeout=30)
    except Exception as e:
        log(f"  (could not clear existing rows: {e})")

    CHUNK = 500
    for i in range(0, len(rows), CHUNK):
        chunk = rows[i:i + CHUNK]
        payload = [{
            "player_id": r["playerId"], "name": r["name"], "position": r["position"],
            "team": r["team"], "proj_points": r["projPoints"], "adp": r["adp"],
            "injury_status": r["injuryStatus"], "usage_trend": r["usageTrend"],
            "is_rookie": r["isRookie"], "bye_week": r["byeWeek"], "playoff_sos": r["playoffSos"],
            "target_share": r["targetShare"], "depth_chart_order": r["depthChartOrder"],
            "games_missed_2y": r["gamesMissed2y"], "draft_round": r["draftRound"],
            "draft_pick": r["draftPick"], "fp_ecr": r["fpEcr"],
        } for r in chunk]
        resp = requests.post(endpoint, headers=headers, data=json.dumps(payload), timeout=60)
        if resp.status_code >= 300:
            log(f"  chunk {i//CHUNK} failed: {resp.status_code} {resp.text[:200]}")
        else:
            log(f"  uploaded {i+len(chunk)}/{len(rows)}")
    log("Supabase upload complete.")


if __name__ == "__main__":
    try:
        build()
    except requests.HTTPError as e:
        log(f"FATAL HTTP error: {e}")
        sys.exit(1)
