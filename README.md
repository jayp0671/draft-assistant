# Fiserv Goons — Live Draft Assistant

Real-time, multi-user fantasy football draft decision-support tool for a
12-team full-PPR snake league. Built to the spec in
`Fantasy_Draft_Assistant_Project_Charter.docx`.

- **Frontend:** React + Vite + Tailwind
- **Backend:** Supabase (Postgres + realtime) — shared draft state for all 12 users
- **Data pipeline:** Python — pulls Sleeper + nflverse + ESPN + CollegeFootballData, scores every player under *your league's exact rules*, freezes into Supabase
- **Engine:** Value-Based Drafting (VORP) + positional scarcity + roster-need weighting, all pure/tested TypeScript in `shared/`
- **Cost:** $0 (all free tiers)

### v1.1 features
- Philadelphia Eagles theme (midnight green / kelly green / silver / charcoal)
- Sleek recommendation cards: scannable VORP / Proj / ADP / Bye / Target% / Tier
  stat strip, reason chips, NEED flags, and live bye-week conflict warnings
- 2026 bye weeks, target share, depth-chart (starter/backup), durability
  (games missed), and rookie draft capital surfaced per player
- FantasyPros consensus ranks as an ADP backup (rate-limited to protect the
  free 50/day cap — only 6 requests per pipeline run)
- **Reset Draft** button (password protected) + a fixed **Undo** button

---

## What's already done & verified
- `shared/` scoring + snake-order + VORP engine — **unit tested, 8/8 passing**
- `web/` full UI — **typechecks clean, production build succeeds**
- `pipeline/build_dataset.py` — full multi-source pull + league scoring + Supabase upload
- `supabase/migrations/` — schema, realtime, RLS, and the 12-team seed

## What you must do to go live (≈20 min)
You need to run the pieces that require your accounts/network. Follow in order.

### 1. Install frontend deps
```bash
cd web
npm install
```

### 2. Set environment variables
Copy the templates and fill in your real keys (they never get committed — `.env`
is gitignored).

**Root `.env`** (for the data pipeline):
```bash
cp .env.example .env
# then edit .env:
#   SUPABASE_URL=https://xxxx.supabase.co
#   SUPABASE_SERVICE_ROLE_KEY=<your service_role key>
#   CFBD_API_KEY=<your collegefootballdata key>
#   FANTASYPROS_API_KEY=<your fantasypros key>   # free tier ~50 req/day; pipeline uses only 6/run
```

**`web/.env`** (for the frontend):
```bash
cp web/.env.example web/.env
# then edit web/.env:
#   VITE_SUPABASE_URL=https://xxxx.supabase.co
#   VITE_SUPABASE_ANON_KEY=<your anon public key>
```

> The service_role key is admin-level — it lives ONLY in the root `.env`, never
> in the frontend. The frontend uses the anon key only.

### 3. Create the database
In your Supabase project → **SQL Editor**, paste and run, in order:
1. `supabase/migrations/0001_init.sql`
2. `supabase/migrations/0002_seed.sql`
3. `supabase/migrations/0003_enrichment_columns.sql`

(Or, with the Supabase CLI: `supabase db push`.)

### 4. Build the player dataset
```bash
cd pipeline
pip install -r requirements.txt
python build_dataset.py
```
This pulls all sources, scores every player under your rules, writes them to
Supabase, and also saves `web/src/data/players.json` as an offline fallback.
Re-run it as close to draft day as possible to catch late injuries/depth changes.

> If a source is temporarily down, the pipeline degrades gracefully and still
> produces a scored dataset from whatever it could reach.

### 5. Run it
```bash
cd web
npm run dev        # http://localhost:5173
```

### 6. Deploy to Vercel (so the whole league can join)
1. Push this repo to GitHub.
2. In Vercel → New Project → import the repo. `vercel.json` is already
   configured (build command, output dir, SPA rewrites).
3. In Vercel project settings → Environment Variables, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy. Share the URL with all 12 league members.

---

## How to use on draft day
1. Everyone opens the shared link and taps their team (you're **#11, jayp671**).
2. As each real pick happens on your league platform, **anyone** taps
   **“+ Log pick”**, picks the team + player, and it syncs to all screens live.
3. When it's a team's turn, the **Recommendations** panel shows the top players
   ranked by value-over-replacement, adjusted for that team's roster and the
   live position runs — each with a plain-English reason.
4. **My Roster** shows your slots filling in, plus the **Turn-Pair Lookahead**
   for your back-to-back picks near the snake turn (#11/#14, #35/#38, …).
5. **Available Players** lets you filter by position, sort, and see value tiers.

If the network drops, the app keeps working in **offline/local mode** using the
bundled `players.json` (draft state is then local to your browser).

---

## Project structure
```
shared/            pure, shared TS: league-config, scoring, engine (+ re-used by web)
pipeline/          python data pipeline -> Supabase + players.json
supabase/          SQL migrations (schema, realtime, RLS, seed)
web/               React app (Vite). components/, hooks/, engine adapter, tests
PROGRESS.md        living build log / handoff notes
```

## Keeping scoring in sync
League scoring is encoded in **two** places that must match:
`shared/league-config.ts` (`SCORING`) and `pipeline/build_dataset.py`
(`SCORING`). If the league changes a rule, update both.

## Tests
```bash
cd web && npm test        # scoring, snake order, and engine behavior
```
