-- Migration: Add progress_snapshots table for stable daily progress history.
-- Captures per-day progress + status for each objective and key result so that
-- forecast/velocity/trend readers have a stable timeline that does not change
-- when individual check-ins are edited or deleted.

CREATE TABLE IF NOT EXISTS progress_snapshots (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id VARCHAR NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id VARCHAR NOT NULL,
  snapshot_date TEXT NOT NULL,
  progress DOUBLE PRECISION DEFAULT 0,
  status TEXT,
  pace_status TEXT,
  source TEXT DEFAULT 'job',
  created_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT progress_snapshots_unique_per_day UNIQUE (tenant_id, entity_type, entity_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_progress_snapshots_entity
  ON progress_snapshots (entity_type, entity_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_progress_snapshots_tenant
  ON progress_snapshots (tenant_id, snapshot_date);
