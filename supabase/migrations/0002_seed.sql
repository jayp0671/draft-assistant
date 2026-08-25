-- ============================================================================
-- Seed: create the one live draft + the 12 confirmed team slots (Charter 3.3)
-- Safe to re-run: uses fixed UUID and upserts.
-- ============================================================================

insert into public.draft (id, name, num_teams, total_rounds, status)
values ('00000000-0000-0000-0000-000000000001', 'Fiserv Goons 2026', 12, 16, 'active')
on conflict (id) do nothing;

insert into public.team_claims (draft_id, team_slot, team_name, owner, session_id) values
  ('00000000-0000-0000-0000-000000000001', 1,  'Team Ben16001',           '@Ben16001',           null),
  ('00000000-0000-0000-0000-000000000001', 2,  'seeyaaaaa',               '@siyav',              null),
  ('00000000-0000-0000-0000-000000000001', 3,  'Team loum67',             '@loum67',             null),
  ('00000000-0000-0000-0000-000000000001', 4,  'Team unspoken38',         '@unspoken38',         null),
  ('00000000-0000-0000-0000-000000000001', 5,  'Team mambaujj',           '@mambaujj',           null),
  ('00000000-0000-0000-0000-000000000001', 6,  'Team Neer12',             '@Neer12',             null),
  ('00000000-0000-0000-0000-000000000001', 7,  'Team bennykimchi',        '@bennykimchi',        null),
  ('00000000-0000-0000-0000-000000000001', 8,  'Team Greenninjaturtle44', '@Greenninjaturtle44', null),
  ('00000000-0000-0000-0000-000000000001', 9,  'Team Atharva25',          '@Atharva25',          null),
  ('00000000-0000-0000-0000-000000000001', 10, 'Team shreya04',           '@shreya04',           null),
  ('00000000-0000-0000-0000-000000000001', 11, 'Team jayp671',            '@jayp671',            null),
  ('00000000-0000-0000-0000-000000000001', 12, 'Team IsaiahP32',          '@IsaiahP32',          null)
on conflict (draft_id, team_slot) do nothing;
