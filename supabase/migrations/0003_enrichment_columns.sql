-- ============================================================================
-- Enrichment columns added for v1.1 (bye weeks, target share, depth chart,
-- durability, draft capital, FantasyPros ECR). Safe to re-run.
-- ============================================================================
alter table public.players add column if not exists target_share     numeric;
alter table public.players add column if not exists depth_chart_order int;
alter table public.players add column if not exists games_missed_2y   int;
alter table public.players add column if not exists draft_round        int;
alter table public.players add column if not exists draft_pick         int;
alter table public.players add column if not exists fp_ecr             numeric;
