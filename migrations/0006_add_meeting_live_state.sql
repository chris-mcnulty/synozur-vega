-- Migration: Add live_state jsonb column to meetings table
-- Backs the new Live Meeting Mode (full-screen presentation view) which
-- persists per-topic timer state, current topic index, pause flag, and a
-- post-meeting summary snapshot directly on the meeting record so a refresh
-- resumes the running session.
ALTER TABLE meetings ADD COLUMN IF NOT EXISTS live_state jsonb;
