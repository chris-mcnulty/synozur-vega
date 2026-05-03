-- Search Performance Indexes Migration
-- Adds pg_trgm GIN indexes on the title/description (and equivalent) columns
-- searched by storage.searchAcrossEntities. These keep ILIKE '%query%' fast
-- on tenants with thousands of records.

-- Enable the trigram extension (no-op if already enabled).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================
-- OBJECTIVES
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_objectives_title_trgm"
ON "objectives" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_objectives_description_trgm"
ON "objectives" USING GIN ("description" gin_trgm_ops);

-- ============================================
-- KEY RESULTS
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_key_results_title_trgm"
ON "key_results" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_key_results_description_trgm"
ON "key_results" USING GIN ("description" gin_trgm_ops);

-- ============================================
-- BIG ROCKS
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_big_rocks_title_trgm"
ON "big_rocks" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_big_rocks_description_trgm"
ON "big_rocks" USING GIN ("description" gin_trgm_ops);

-- ============================================
-- STRATEGIES
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_strategies_title_trgm"
ON "strategies" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_strategies_description_trgm"
ON "strategies" USING GIN ("description" gin_trgm_ops);

-- ============================================
-- TEAMS  (search uses name + description)
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_teams_name_trgm"
ON "teams" USING GIN ("name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_teams_description_trgm"
ON "teams" USING GIN ("description" gin_trgm_ops);

-- ============================================
-- MEETINGS  (search uses title + summary)
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_meetings_title_trgm"
ON "meetings" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_meetings_summary_trgm"
ON "meetings" USING GIN ("summary" gin_trgm_ops);

-- ============================================
-- SUPPORT TICKETS  (search uses subject + description)
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_support_tickets_subject_trgm"
ON "support_tickets" USING GIN ("subject" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_support_tickets_description_trgm"
ON "support_tickets" USING GIN ("description" gin_trgm_ops);

-- ============================================
-- GROUNDING DOCUMENTS  (search uses title + description + content)
-- ============================================
CREATE INDEX IF NOT EXISTS "idx_grounding_documents_title_trgm"
ON "grounding_documents" USING GIN ("title" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_grounding_documents_description_trgm"
ON "grounding_documents" USING GIN ("description" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "idx_grounding_documents_content_trgm"
ON "grounding_documents" USING GIN ("content" gin_trgm_ops);
