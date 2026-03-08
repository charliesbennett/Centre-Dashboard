-- Room Form Tokens
-- Stores shareable tokens that allow group leaders to fill in rooming assignments
-- Run this in the Supabase SQL editor

CREATE TABLE IF NOT EXISTS room_form_tokens (
  token        TEXT PRIMARY KEY,
  centre_id    TEXT NOT NULL,
  group_id     TEXT NOT NULL,
  group_name   TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Allow public read (token lookup by form page) and staff insert/delete
-- RLS is currently bypassed so this is informational for when auth is added
ALTER TABLE room_form_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read by token"
  ON room_form_tokens FOR SELECT
  USING (true);

CREATE POLICY "Authenticated insert"
  ON room_form_tokens FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Authenticated delete"
  ON room_form_tokens FOR DELETE
  USING (true);
