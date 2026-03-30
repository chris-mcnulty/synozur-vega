-- Migration: Add meeting_time column to meetings table
-- This column was defined in schema but never applied to the DB
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS meeting_time text;
