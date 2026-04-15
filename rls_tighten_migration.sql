-- RLS tighten: remove permissive write access granted in Option A.
-- Replaces anon_all_* policies with SELECT-only where needed.
-- Run this AFTER adding SUPABASE_SERVICE_ROLE_KEY to your environment.
--
-- Anon key still needs SELECT on:
--   app_users        — login (SHA-256 auth check)
--   rota_cells       — Realtime subscriptions
--   programme_cells  — Realtime subscriptions
--   excursion_days   — Realtime subscriptions
--   excursions       — Realtime subscriptions
--   rooming_assignments — Realtime subscriptions
--
-- All other tables: no anon access (all writes go through /api/db/* routes via service_role).

-- Drop the blanket anon_all policies added in Option A
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'centres','app_users','groups','students','staff',
    'rota_cells','programme_cells','programme_settings','programme_archives',
    'transfers','excursions','excursion_days',
    'rooming_houses','rooming_rooms','rooming_assignments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "anon_all_%s" ON %I', t, t);
  END LOOP;
END $$;

-- Grant SELECT-only to anon on tables needed for login + Realtime
CREATE POLICY "anon_select_app_users"           ON app_users            FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_rota_cells"          ON rota_cells           FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_programme_cells"     ON programme_cells      FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_excursion_days"      ON excursion_days       FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_excursions"          ON excursions           FOR SELECT TO anon USING (true);
CREATE POLICY "anon_select_rooming_assignments" ON rooming_assignments  FOR SELECT TO anon USING (true);
