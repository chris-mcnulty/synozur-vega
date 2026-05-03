-- Migration: Add agenda_times jsonb column to meetings table
-- Stores per-topic target time budgets (minutes) keyed by agenda index as string
-- (e.g. {"0": 5, "2": 10}). Used by Live Meeting Mode to display per-topic
-- remaining time and warn on overruns.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS agenda_times jsonb;
