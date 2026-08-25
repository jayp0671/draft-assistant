-- ============================================================================
-- Fiserv Goons Draft Assistant — Schema (Charter 6.1)
-- Run this in the Supabase SQL Editor (or via `supabase db push`).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- players: the frozen, league-scored reference dataset (written by pipeline)
-- ---------------------------------------------------------------------------
create table if not exists public.players (
  player_id      text primary key,
  name           text not null,
  position       text not null check (position in ('QB','RB','WR','TE','K','DEF')),
  team           text,
  proj_points    numeric not null default 0,
  adp            numeric not null default 999,
  injury_status  text,
  usage_trend    numeric default 0,
  is_rookie      boolean default false,
  bye_week       int,
  playoff_sos    numeric,
  updated_at     timestamptz default now()
);

create index if not exists players_pos_idx  on public.players (position);
create index if not exists players_proj_idx on public.players (proj_points desc);
create index if not exists players_adp_idx  on public.players (adp asc);

-- ---------------------------------------------------------------------------
-- draft: a single draft session (one row for the league's live draft)
-- ---------------------------------------------------------------------------
create table if not exists public.draft (
  id           uuid primary key default gen_random_uuid(),
  name         text not null default 'Fiserv Goons 2026',
  num_teams    int not null default 12,
  total_rounds int not null default 16,
  status       text not null default 'active' check (status in ('active','paused','complete')),
  created_at   timestamptz default now()
);

-- ---------------------------------------------------------------------------
-- team_claims: which browser session "is" which of the 12 teams
-- (lightweight, no auth — Charter R7)
-- ---------------------------------------------------------------------------
create table if not exists public.team_claims (
  draft_id    uuid not null references public.draft(id) on delete cascade,
  team_slot   int  not null check (team_slot between 1 and 12),
  team_name   text not null,
  owner       text,
  session_id  text,               -- random client id that claimed it
  claimed_at  timestamptz default now(),
  primary key (draft_id, team_slot)
);

-- ---------------------------------------------------------------------------
-- picks: every pick logged, in order (Charter R2/R3)
-- ---------------------------------------------------------------------------
create table if not exists public.picks (
  id           bigserial primary key,
  draft_id     uuid not null references public.draft(id) on delete cascade,
  overall_pick int  not null,
  round        int  not null,
  team_slot    int  not null check (team_slot between 1 and 12),
  player_id    text not null references public.players(player_id),
  logged_by    text,               -- session id that logged it
  created_at   timestamptz default now(),
  unique (draft_id, overall_pick),        -- one player per pick slot
  unique (draft_id, player_id)            -- a player can only be drafted once
);

create index if not exists picks_draft_idx on public.picks (draft_id, overall_pick);

-- ---------------------------------------------------------------------------
-- Realtime: publish tables so all clients get live updates (Charter R2)
-- ---------------------------------------------------------------------------
alter publication supabase_realtime add table public.picks;
alter publication supabase_realtime add table public.team_claims;
alter publication supabase_realtime add table public.draft;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- This is a private league tool with no per-user auth. We enable RLS and allow
-- anon read/write ONLY to draft-state tables (picks, team_claims, draft).
-- The players table is read-only to anon; only the service_role (pipeline)
-- may write it. Service role bypasses RLS automatically.
-- ---------------------------------------------------------------------------
alter table public.players     enable row level security;
alter table public.draft       enable row level security;
alter table public.team_claims enable row level security;
alter table public.picks       enable row level security;

-- players: anon can read, nobody-but-service-role can write
drop policy if exists players_read on public.players;
create policy players_read on public.players
  for select using (true);

-- draft: anon read + update status
drop policy if exists draft_read on public.draft;
create policy draft_read on public.draft for select using (true);
drop policy if exists draft_write on public.draft;
create policy draft_write on public.draft for all using (true) with check (true);

-- team_claims: anon full access (claim/unclaim)
drop policy if exists claims_all on public.team_claims;
create policy claims_all on public.team_claims for all using (true) with check (true);

-- picks: anon full access (log / correct picks) — Charter R3
drop policy if exists picks_all on public.picks;
create policy picks_all on public.picks for all using (true) with check (true);
