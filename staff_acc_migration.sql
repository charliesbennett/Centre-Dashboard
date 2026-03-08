-- Add accommodation column to staff table (run once in Supabase SQL editor)
ALTER TABLE staff ADD COLUMN IF NOT EXISTS accommodation TEXT NOT NULL DEFAULT 'Residential';
