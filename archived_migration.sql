-- Add archived column to groups table
ALTER TABLE groups ADD COLUMN IF NOT EXISTS archived BOOLEAN NOT NULL DEFAULT false;
