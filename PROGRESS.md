# PROGRESS — Fiserv Goons Draft Assistant

**Living handoff doc.** New session reads this + the charter in project sources
(/mnt/project/Fantasy_Draft_Assistant_Project_Charter.docx) and continues.

Last updated: **build session 2 — v1.1 shipped.** Typechecks clean (TS 5.9),
production build succeeds (91 modules), 8/8 unit tests pass, UI visually verified
via Playwright screenshots (Eagles theme, sleek rec cards).

---

## Status: COMPLETE + ENHANCED. Live-verified in browser.

### v1.0 (session 1) — all done
Engine (VORP + scarcity + need + guardrails), scoring, snake order, all React
components, Supabase schema + realtime + RLS, Python pipeline, README, configs.

### v1.1 (session 2) — all done
1. **Undo fixed** — `useDraft` now uses a live `picksRef` (no stale closure),
   deletes the max overall_pick, always refetches, surfaces errors via toast.
2. **Reset draft w/ password** — `resetDraft(password)` in useDraft; password is
   `GO.BIRDS.DH`; `ResetModal.tsx` gates it; wired to header "Reset" button.
3. **Eagles theme** — tailwind palette: midnight #004C54, kelly #3CB371,
   silver #A5ACAF, charcoal #0A0F0E base. Radial-glow bg in index.css.
   All components remapped off old panel/teal/navy tokens.
4. **Sleek recommendation cards** — Recommendations.tsx rebuilt: rank rail,
   name row, clean stat strip (VORP/Proj/ADP/Bye/Tgt%/Tier via <Stat>),
   reason chips (value/reach/starter/depth/durability/rookie), NEED flag,
   bye-conflict detection vs on-clock roster, green Draft button.
5. **Data enrichment** in pipeline + Player type + DB:
   - 2026 bye weeks (exact, hardcoded in shared/schedule.ts + pipeline)
   - target share, depth chart order (starter/backup), games-missed-2y
   - rookie draft capital (round/pick) from nflverse load_draft_picks
   - FantasyPros consensus ECR as ADP backup — **rate limited**: 6 requests
     total (one per position), 1.2s spacing, stops on 429. Well under 50/day cap.
6. **New DB columns** — supabase/migrations/0003_enrichment_columns.sql
   (target_share, depth_chart_order, games_missed_2y, draft_round, draft_pick, fp_ecr)

---

## KEYS / ENV (unchanged + one new)
Root `.env`: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CFBD_API_KEY,
  **FANTASYPROS_API_KEY** (new). web/.env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY.
Never hardcoded; .env gitignored; only .env.example committed.

## INVARIANTS (do not violate)
- Scoring encoded in BOTH shared/league-config.ts (SCORING) and
  pipeline/build_dataset.py (SCORING). Change together.
- Bye weeks in BOTH shared/schedule.ts and pipeline BYE_WEEKS_2026. Change together.
- Engine stays pure. Verified: QB=270/RB=282 scoring; pick14->slot11; round-1
  favors RB/WR over 402pt QB, suppresses K.
- FantasyPros: keep it to ≤6 requests/run to respect the 50/day free cap.
- tsconfig needs `ignoreDeprecations: "5.0"` + `baseUrl: "."` for path aliases
  (TS 5.9 deprecation quirk).

## USER'S REMAINING STEPS (only these — need their machine/accounts)
1. `cd web && npm install`  (done already once)
2. fill root `.env` (+ new FANTASYPROS_API_KEY) and `web/.env`
3. run migrations 0001, 0002, 0003 in Supabase SQL editor
4. `cd pipeline && pip install -r requirements.txt && python build_dataset.py`
5. `cd web && npm run dev`  (or deploy to Vercel w/ the 2 VITE_ envs)
- Reset the board anytime via the in-app Reset button (password GO.BIRDS.DH)
  or SQL: delete from picks; update team_claims set session_id=null.

## OPEN ITEMS / KNOWN LIMITS
- playoffSos still null (bye weeks now populated). Could enrich from a schedule
  strength source later; UI shows "—" gracefully.
- ESPN projection endpoint undocumented; pipeline degrades to FP ECR then rank.
- Name-matching across sources uses normalized names; a few edge names may miss
  enrichment (falls back cleanly, never crashes).
