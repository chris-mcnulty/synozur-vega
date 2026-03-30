-- Migration: Fix three production schema bugs
-- 1. Add missing duration column to meetings table
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS duration integer;

-- 2. Drop NOT NULL constraints from check_ins progress columns
--    (Drizzle schema marks these as nullable but live DB had NOT NULL)
ALTER TABLE check_ins ALTER COLUMN new_progress DROP NOT NULL;
ALTER TABLE check_ins ALTER COLUMN previous_progress DROP NOT NULL;
