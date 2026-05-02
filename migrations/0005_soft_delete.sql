-- Migration: Soft delete columns for strategic data
-- Adds deleted_at / deleted_by to objectives, key_results, big_rocks, big_rock_tasks,
-- strategies, and to ambitions inside foundations.ambitions JSONB. Read queries
-- exclude soft-deleted rows by default. A scheduled job purges rows where
-- deleted_at is older than 30 days.

ALTER TABLE objectives ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE objectives ADD COLUMN IF NOT EXISTS deleted_by varchar;

ALTER TABLE key_results ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE key_results ADD COLUMN IF NOT EXISTS deleted_by varchar;

ALTER TABLE big_rocks ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE big_rocks ADD COLUMN IF NOT EXISTS deleted_by varchar;

ALTER TABLE big_rock_tasks ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE big_rock_tasks ADD COLUMN IF NOT EXISTS deleted_by varchar;

ALTER TABLE strategies ADD COLUMN IF NOT EXISTS deleted_at timestamp;
ALTER TABLE strategies ADD COLUMN IF NOT EXISTS deleted_by varchar;

CREATE INDEX IF NOT EXISTS idx_objectives_deleted_at ON objectives (deleted_at);
CREATE INDEX IF NOT EXISTS idx_key_results_deleted_at ON key_results (deleted_at);
CREATE INDEX IF NOT EXISTS idx_big_rocks_deleted_at ON big_rocks (deleted_at);
CREATE INDEX IF NOT EXISTS idx_big_rock_tasks_deleted_at ON big_rock_tasks (deleted_at);
CREATE INDEX IF NOT EXISTS idx_strategies_deleted_at ON strategies (deleted_at);
