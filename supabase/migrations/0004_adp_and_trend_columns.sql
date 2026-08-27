-- ============================================================================
-- v1.2: independent FFC ADP + ADP confidence + career-arc / recency signals.
-- Safe to re-run.
-- ============================================================================
alter table public.players add column if not exists ffc_adp          numeric;
alter table public.players add column if not exists adp_confidence   text;
alter table public.players add column if not exists adp_spread       numeric;
alter table public.players add column if not exists career_trend     text;
alter table public.players add column if not exists career_trend_pct numeric;
alter table public.players add column if not exists recency_ppg      numeric;
