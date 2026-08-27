# Fiserv Goons v2.0 targeted hotfix

Built against repository commit `cc4c21bafa33b1777d36a1525fdb86e64c6a3c08` (`v2.0`).

This overlay intentionally changes only confirmed/safety-critical defects:

- `web/src/components/DraftBoard.tsx`
  - fixes the literal `font-mono` text accidentally rendered before recent-pick numbers.
- `pipeline/build_dataset.py`
  - never silently substitutes prior-season FFC ADP when 2026 data is unavailable;
  - fixes ESPN projection selection at the source: selects the projected season-total stat split (`statSplitTypeId == 0`, with `scoringPeriodId == 0` compatibility fallback) instead of whichever projected row appears first;
  - removes the unsafe `<100 => x17` projection heuristic entirely;
  - validates the merged dataset before persistence;
  - atomically writes `players.json`, so a failed/partial build cannot overwrite a last-known-good offline snapshot;
  - refuses to push an obviously empty/partial/per-game-scale dataset to Supabase.
- `pipeline/test_build_dataset.py`
  - regression tests for all of the above.

## Apply

Extract this ZIP at the **repository root** and allow files to overwrite.

## Verify

From the repository root:

```bash
python -m unittest discover -s pipeline -p 'test_*.py' -v
cd web
npm test
npm run build
```

Then return to the repository root and regenerate the real player snapshot with your configured API/Supabase environment:

```bash
python pipeline/build_dataset.py
```

### Important about `players.json`

The current v2.0 repository has `web/src/data/players.json` committed as `[]`. This ZIP deliberately does **not** replace it with fabricated, stale, or test data. A valid live dataset requires the project's real upstream API calls and your configured keys. Run `python pipeline/build_dataset.py` once after applying the hotfix; the new validation/atomic-write logic will only replace the snapshot when the generated dataset passes sanity checks.
