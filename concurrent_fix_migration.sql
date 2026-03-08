-- ─────────────────────────────────────────────────────────────────────────────
-- Concurrent Editing Fix Migration
-- Run this in the Supabase SQL editor ONCE.
--
-- What this does:
--   1. Adds unique indexes on natural keys so Supabase can do conflict-free
--      upserts (instead of delete-all + insert-all).
--   2. Sets REPLICA IDENTITY FULL on grid tables so Realtime DELETE events
--      include the full row (not just the PK), allowing clients to identify
--      which key to remove from their local grid.
--   3. Creates the `excursions` table for storing excursion destination / coach
--      data per date.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Unique indexes for upsert on natural keys ─────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS idx_rota_cells_natural
  ON rota_cells (centre_id, staff_id, cell_date, slot);

CREATE UNIQUE INDEX IF NOT EXISTS idx_prog_cells_natural
  ON programme_cells (centre_id, group_id, cell_date, slot);

CREATE UNIQUE INDEX IF NOT EXISTS idx_exc_days_natural
  ON excursion_days (centre_id, exc_date);

-- For rooming_assignments, one occupant per bed slot (room + slot_index)
CREATE UNIQUE INDEX IF NOT EXISTS idx_rooming_assign_natural
  ON rooming_assignments (centre_id, room_id, slot_index);

-- ── 2. REPLICA IDENTITY FULL for complete DELETE event payloads ───────────────
-- Without this, DELETE events only contain the primary key (id), which isn't
-- enough to find the cell in local state. FULL sends the entire old row.

ALTER TABLE rota_cells REPLICA IDENTITY FULL;
ALTER TABLE programme_cells REPLICA IDENTITY FULL;
ALTER TABLE excursion_days REPLICA IDENTITY FULL;
ALTER TABLE rooming_assignments REPLICA IDENTITY FULL;

-- ── 3. Excursions table (destination + coaches per date) ─────────────────────

CREATE TABLE IF NOT EXISTS excursions (
  id          TEXT PRIMARY KEY,
  centre_id   TEXT NOT NULL,
  exc_date    DATE NOT NULL,
  destination TEXT NOT NULL DEFAULT '',
  coaches     JSONB NOT NULL DEFAULT '[]',
  notes       TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_excursions_natural
  ON excursions (centre_id, exc_date);

ALTER TABLE excursions REPLICA IDENTITY FULL;

ALTER TABLE excursions ENABLE ROW LEVEL SECURITY;
CREATE POLICY IF NOT EXISTS "excursions_all" ON excursions FOR ALL USING (true) WITH CHECK (true);

-- ── Enable Realtime for all grid tables ──────────────────────────────────────
-- (Tables must be added to the Supabase Realtime publication to receive events)

ALTER PUBLICATION supabase_realtime ADD TABLE rota_cells;
ALTER PUBLICATION supabase_realtime ADD TABLE programme_cells;
ALTER PUBLICATION supabase_realtime ADD TABLE excursion_days;
ALTER PUBLICATION supabase_realtime ADD TABLE rooming_assignments;
ALTER PUBLICATION supabase_realtime ADD TABLE excursions;
