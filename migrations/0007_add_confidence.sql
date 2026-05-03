-- Migration: Add owner-reported confidence to check-ins and progress snapshots
-- Confidence is a 0.0–1.0 (0.1 step) value entered by the owner on each
-- check-in, indicating how likely they think the OKR will hit by period end.
-- Snapshots carry the latest confidence at end-of-day so we can render trend
-- sparklines and detect "confidence dropping" without re-querying check-ins.
ALTER TABLE check_ins ADD COLUMN IF NOT EXISTS confidence double precision;
ALTER TABLE progress_snapshots ADD COLUMN IF NOT EXISTS confidence double precision;
