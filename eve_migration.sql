-- EVE slot migration for programme_cells
-- Run this once in Supabase: Database > SQL Editor > New query
--
-- This removes any check constraint on the slot column that limits it to ('AM', 'PM'),
-- so that EVE values can also be stored for Ministay evening activities.

-- Step 1: Drop any existing slot check constraint
-- (Try all likely auto-generated names)
ALTER TABLE programme_cells DROP CONSTRAINT IF EXISTS programme_cells_slot_check;
ALTER TABLE programme_cells DROP CONSTRAINT IF EXISTS programme_cells_slot_fkey;

-- Step 2: If the column is an enum type, change it to plain text
-- (Only needed if the column was defined as an enum rather than TEXT)
-- ALTER TABLE programme_cells ALTER COLUMN slot TYPE TEXT;

-- Step 3: Add a new constraint that includes EVE
-- (Optional — only add if you want strict validation)
-- ALTER TABLE programme_cells ADD CONSTRAINT programme_cells_slot_check
--   CHECK (slot IN ('AM', 'PM', 'EVE'));

-- If none of the above fix it, check the actual constraint name with:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'programme_cells'::regclass;
-- Then run: ALTER TABLE programme_cells DROP CONSTRAINT <conname>;
