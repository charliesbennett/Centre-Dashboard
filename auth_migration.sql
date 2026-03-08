-- Authentication migration: ensure app_users table exists with all required columns
-- Run this in the Supabase SQL editor before deploying auth changes.

CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'centre_manager',
  centre_id UUID REFERENCES centres(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add missing columns if table already exists
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'centre_manager';
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS centre_id UUID REFERENCES centres(id);
ALTER TABLE app_users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
