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

---

## v1.2 (build session 3) — DATA HARDENING + REASONING + TESTS. All done.
Draft is imminent; this pass focused on data trust + explainability.

1. **projPoints per-game bug FIXED** — ESPN returns per-game applied totals;
   pipeline now scales `proj * 17` when value < 100. (Chase now ~323, not 19.)
2. **pyarrow added to requirements** — nflverse draft-capital + stats need it;
   was silently failing. Rookie draft round/pick now populate correctly.
3. **FFC ADP (independent source)** — Fantasy Football Calculator 12-team PPR
   real-draft ADP via free REST API (no key, no scraping). Stored as `ffcAdp`,
   kept separate from ESPN. Engine uses EFFECTIVE adp = ffcAdp || adp.
4. **ADP confidence** — when ESPN and FFC disagree >25%, player flagged
   `adpConfidence:"low"` + `adpSpread`. Shown as "ADP uncertain" chip.
5. **Career arcs** — nflverse multi-season usage (targets+carries+rec) change:
   `careerTrend` rising/stable/declining (±15% thresholds) + `careerTrendPct`.
   Rising gets +4% score nudge, declining -4%. Shown as chip.
6. **Recency signal** — `recencyPpg` = avg PPR pts/game over last up-to-5 games
   of prior season. Shown as "hot: X PPG late" chip when >=14.
7. **Per-pick REASONING paragraph** — new `buildReasoning()` in engine produces
   a deterministic 2-5 sentence "why this pick" from the facts (value framing,
   roster fit, ADP/market, strategy guardrail, enrichment color). Rendered under
   each rec card with a green left border. Also `Recommendation.reasoning`,
   `.posRank`, `.tier` added.
8. **Turn-pair upgraded** — now returns `{grabNow, likelyAtNext, strategy, gap}`.
   grabNow = value unlikely to survive to next pick; likelyAtNext = safe to wait.
   `strategy` is a plain-language pair plan. MyRoster shows two columns + strategy.
9. **Meticulous test suite** — web/src/engine/engine.test.ts, 31 tests incl. a
   FULL 192-pick draft simulation asserting Jay's roster is legal + sane, plus
   scoring exactness, snake order, byes (all 32), baselines, need accounting,
   reasoning non-empty, effective-ADP=FFC, kicker suppression, QB timing.
   ALL 31 PASS. Build + typecheck clean. Visually verified via Playwright.

### New DB columns — supabase/migrations/0004_adp_and_trend_columns.sql
ffc_adp, adp_confidence, adp_spread, career_trend, career_trend_pct, recency_ppg
Run 0004 in Supabase before the next pipeline run.

### New env — FANTASYPROS_API_KEY already in .env.example. FFC needs NO key.

### To deploy v1.2 (user):
1. run migration 0004 in Supabase SQL editor
2. `cd pipeline && pip install -r requirements.txt` (gets pyarrow)
3. `python build_dataset.py`  (fresh pull w/ FFC + trends)
4. `cd web && npm install && npm run build` then redeploy / git push
