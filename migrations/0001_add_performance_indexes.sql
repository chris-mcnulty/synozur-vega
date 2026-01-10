-- Performance Indexes Migration
-- This migration adds indexes to improve query performance
-- on commonly-used query patterns identified in storage.ts

-- ============================================
-- OBJECTIVES TABLE INDEXES
-- ============================================

-- Index for getObjectivesByTenantId() which filters by tenant, year, quarter
-- This is one of the most frequently called queries (used in hierarchy loading)
CREATE INDEX IF NOT EXISTS "idx_objectives_tenant_year_quarter" 
ON "objectives" ("tenant_id", "year", "quarter");

-- Index for getChildObjectives() which filters by parent_id
CREATE INDEX IF NOT EXISTS "idx_objectives_parent_id" 
ON "objectives" ("parent_id") WHERE "parent_id" IS NOT NULL;

-- Index for filtering objectives by owner
CREATE INDEX IF NOT EXISTS "idx_objectives_owner_id" 
ON "objectives" ("owner_id") WHERE "owner_id" IS NOT NULL;

-- Index for filtering objectives by team
CREATE INDEX IF NOT EXISTS "idx_objectives_team_id" 
ON "objectives" ("team_id") WHERE "team_id" IS NOT NULL;

-- ============================================
-- KEY_RESULTS TABLE INDEXES
-- ============================================

-- Index for getKeyResultsByObjectiveId() - heavily used in hierarchy building
CREATE INDEX IF NOT EXISTS "idx_key_results_objective_id" 
ON "key_results" ("objective_id");

-- Index for tenant-scoped key result queries
CREATE INDEX IF NOT EXISTS "idx_key_results_tenant_id" 
ON "key_results" ("tenant_id");

-- Index for key results with Planner sync enabled
CREATE INDEX IF NOT EXISTS "idx_key_results_planner_sync" 
ON "key_results" ("planner_sync_enabled") WHERE "planner_sync_enabled" = true;

-- ============================================
-- BIG_ROCKS TABLE INDEXES
-- ============================================

-- Index for getBigRocksByTenantId() which filters by tenant, year, quarter
CREATE INDEX IF NOT EXISTS "idx_big_rocks_tenant_year_quarter" 
ON "big_rocks" ("tenant_id", "year", "quarter");

-- Index for getBigRocksByObjectiveId()
CREATE INDEX IF NOT EXISTS "idx_big_rocks_objective_id" 
ON "big_rocks" ("objective_id") WHERE "objective_id" IS NOT NULL;

-- Index for getBigRocksByKeyResultId()
CREATE INDEX IF NOT EXISTS "idx_big_rocks_key_result_id" 
ON "big_rocks" ("key_result_id") WHERE "key_result_id" IS NOT NULL;

-- Index for big rocks with Planner sync enabled
CREATE INDEX IF NOT EXISTS "idx_big_rocks_planner_sync" 
ON "big_rocks" ("planner_sync_enabled") WHERE "planner_sync_enabled" = true;

-- ============================================
-- CHECK_INS TABLE INDEXES
-- ============================================

-- Index for getCheckInsByEntityId() and getLatestCheckIn()
-- This is critical for the batch query method getLatestCheckInsForEntities()
CREATE INDEX IF NOT EXISTS "idx_check_ins_entity_type_entity_id" 
ON "check_ins" ("entity_type", "entity_id");

-- Index for check-ins ordered by date (for latest check-in queries)
CREATE INDEX IF NOT EXISTS "idx_check_ins_entity_id_as_of_date" 
ON "check_ins" ("entity_id", "as_of_date" DESC);

-- Index for tenant-scoped check-in queries
CREATE INDEX IF NOT EXISTS "idx_check_ins_tenant_id" 
ON "check_ins" ("tenant_id");

-- ============================================
-- AI_USAGE_LOGS TABLE INDEXES
-- ============================================

-- Index for getAiUsageLogs() which filters by tenant and date range
CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_tenant_created_at" 
ON "ai_usage_logs" ("tenant_id", "created_at" DESC);

-- Index for getPlatformAiUsageSummary() which filters by date range
CREATE INDEX IF NOT EXISTS "idx_ai_usage_logs_created_at" 
ON "ai_usage_logs" ("created_at" DESC);

-- ============================================
-- USERS TABLE INDEXES
-- ============================================

-- Index for getAllUsers() with tenantId filter (very common pattern)
CREATE INDEX IF NOT EXISTS "idx_users_tenant_id" 
ON "users" ("tenant_id") WHERE "tenant_id" IS NOT NULL;

-- Index for Azure SSO user lookup
CREATE INDEX IF NOT EXISTS "idx_users_azure_object_id" 
ON "users" ("azure_object_id") WHERE "azure_object_id" IS NOT NULL;

-- ============================================
-- MEETINGS TABLE INDEXES
-- ============================================

-- Index for getMeetingsByTenantId()
CREATE INDEX IF NOT EXISTS "idx_meetings_tenant_id" 
ON "meetings" ("tenant_id");

-- Index for meetings with Outlook sync
CREATE INDEX IF NOT EXISTS "idx_meetings_outlook_event_id" 
ON "meetings" ("outlook_event_id") WHERE "outlook_event_id" IS NOT NULL;

-- Index for recurring meeting series
CREATE INDEX IF NOT EXISTS "idx_meetings_series_id" 
ON "meetings" ("series_id") WHERE "series_id" IS NOT NULL;

-- ============================================
-- STRATEGIES TABLE INDEXES
-- ============================================

-- Index for getStrategiesByTenantId()
CREATE INDEX IF NOT EXISTS "idx_strategies_tenant_id" 
ON "strategies" ("tenant_id");

-- ============================================
-- PAGE_VISITS TABLE INDEXES (Analytics)
-- ============================================

-- Index for getPageVisitStats() date range queries
CREATE INDEX IF NOT EXISTS "idx_page_visits_visited_at" 
ON "page_visits" ("visited_at" DESC);

-- Index for analytics by page
CREATE INDEX IF NOT EXISTS "idx_page_visits_page" 
ON "page_visits" ("page");

-- ============================================
-- JUNCTION TABLE INDEXES
-- ============================================

-- Index for getBigRocksLinkedToObjective() - optimizes JOIN performance
CREATE INDEX IF NOT EXISTS "idx_objective_big_rocks_objective_id" 
ON "objective_big_rocks" ("objective_id");

-- Index for getBigRocksLinkedToKeyResult()
CREATE INDEX IF NOT EXISTS "idx_key_result_big_rocks_key_result_id" 
ON "key_result_big_rocks" ("key_result_id");

-- Index for getPlannerTasksLinkedToObjective()
CREATE INDEX IF NOT EXISTS "idx_objective_planner_tasks_objective_id" 
ON "objective_planner_tasks" ("objective_id");

-- Index for getPlannerTasksLinkedToBigRock()
CREATE INDEX IF NOT EXISTS "idx_big_rock_planner_tasks_big_rock_id" 
ON "big_rock_planner_tasks" ("big_rock_id");

-- Index for objective values lookup
CREATE INDEX IF NOT EXISTS "idx_objective_values_objective_id" 
ON "objective_values" ("objective_id");

-- Index for value-based queries
CREATE INDEX IF NOT EXISTS "idx_objective_values_tenant_value" 
ON "objective_values" ("tenant_id", "value_title");

-- Index for strategy values lookup
CREATE INDEX IF NOT EXISTS "idx_strategy_values_strategy_id" 
ON "strategy_values" ("strategy_id");

-- Index for value-based strategy queries
CREATE INDEX IF NOT EXISTS "idx_strategy_values_tenant_value" 
ON "strategy_values" ("tenant_id", "value_title");

-- ============================================
-- PLANNER TABLES INDEXES
-- ============================================

-- Index for getPlannerPlansByTenantId()
CREATE INDEX IF NOT EXISTS "idx_planner_plans_tenant_id" 
ON "planner_plans" ("tenant_id");

-- Index for getPlannerBucketsByPlanId()
CREATE INDEX IF NOT EXISTS "idx_planner_buckets_plan_id" 
ON "planner_buckets" ("plan_id");

-- Index for getPlannerTasksByPlanId()
CREATE INDEX IF NOT EXISTS "idx_planner_tasks_plan_id" 
ON "planner_tasks" ("plan_id");

-- Index for getPlannerTasksByBucketId()
CREATE INDEX IF NOT EXISTS "idx_planner_tasks_bucket_id" 
ON "planner_tasks" ("bucket_id") WHERE "bucket_id" IS NOT NULL;

-- ============================================
-- GRAPH_TOKENS TABLE INDEXES
-- ============================================

-- Index for getGraphToken() lookup
CREATE INDEX IF NOT EXISTS "idx_graph_tokens_user_id_service" 
ON "graph_tokens" ("user_id", "service");

-- ============================================
-- GROUNDING_DOCUMENTS TABLE INDEXES
-- ============================================

-- Index for getActiveGroundingDocumentsForTenant()
CREATE INDEX IF NOT EXISTS "idx_grounding_documents_tenant_active" 
ON "grounding_documents" ("tenant_id", "is_active");

-- Index for global grounding documents
CREATE INDEX IF NOT EXISTS "idx_grounding_documents_global_active" 
ON "grounding_documents" ("is_active") WHERE "tenant_id" IS NULL;

-- ============================================
-- CONSULTANT_TENANT_ACCESS TABLE INDEXES
-- ============================================

-- Index for getConsultantTenantAccess()
CREATE INDEX IF NOT EXISTS "idx_consultant_access_consultant_id" 
ON "consultant_tenant_access" ("consultant_user_id");

-- Index for getConsultantsWithAccessToTenant()
CREATE INDEX IF NOT EXISTS "idx_consultant_access_tenant_id" 
ON "consultant_tenant_access" ("tenant_id");

-- ============================================
-- LAUNCHPAD_SESSIONS TABLE INDEXES
-- ============================================

-- Index for getLaunchpadSessions()
CREATE INDEX IF NOT EXISTS "idx_launchpad_sessions_tenant_user" 
ON "launchpad_sessions" ("tenant_id", "user_id");

-- ============================================
-- TENANTS TABLE INDEXES
-- ============================================

-- GIN index for getTenantByDomain() - enables efficient JSONB array search
-- This replaces the current in-memory filtering approach
CREATE INDEX IF NOT EXISTS "idx_tenants_allowed_domains" 
ON "tenants" USING GIN ("allowed_domains");

-- Index for getTenantsWithExpiringPlans()
CREATE INDEX IF NOT EXISTS "idx_tenants_plan_status_expires" 
ON "tenants" ("plan_status", "plan_expires_at");

-- Index for Azure tenant lookup
CREATE INDEX IF NOT EXISTS "idx_tenants_azure_tenant_id" 
ON "tenants" ("azure_tenant_id") WHERE "azure_tenant_id" IS NOT NULL;

-- ============================================
-- IMPORT_HISTORY TABLE INDEXES
-- ============================================

-- Index for getImportHistory()
CREATE INDEX IF NOT EXISTS "idx_import_history_tenant_id" 
ON "import_history" ("tenant_id", "imported_at" DESC);

-- ============================================
-- REPORT TABLES INDEXES
-- ============================================

-- Index for getReviewSnapshotsByTenantId()
CREATE INDEX IF NOT EXISTS "idx_review_snapshots_tenant_year" 
ON "review_snapshots" ("tenant_id", "year", "quarter");

-- Index for getReportInstances()
CREATE INDEX IF NOT EXISTS "idx_report_instances_tenant_year" 
ON "report_instances" ("tenant_id", "year");

-- Index for getReportTemplates()
CREATE INDEX IF NOT EXISTS "idx_report_templates_tenant_id" 
ON "report_templates" ("tenant_id");

-- ============================================
-- TEAMS TABLE INDEXES
-- ============================================

-- Index for getTeamsByTenantId()
CREATE INDEX IF NOT EXISTS "idx_teams_tenant_id" 
ON "teams" ("tenant_id");

-- Index for hierarchical team queries
CREATE INDEX IF NOT EXISTS "idx_teams_parent_team_id" 
ON "teams" ("parent_team_id") WHERE "parent_team_id" IS NOT NULL;

-- ============================================
-- KPIS TABLE INDEXES
-- ============================================

-- Index for getKpisByTenantId()
CREATE INDEX IF NOT EXISTS "idx_kpis_tenant_year_quarter" 
ON "kpis" ("tenant_id", "year", "quarter");

-- ============================================
-- OKRS (LEGACY) TABLE INDEXES
-- ============================================

-- Index for getOkrsByTenantId()
CREATE INDEX IF NOT EXISTS "idx_okrs_tenant_year_quarter" 
ON "okrs" ("tenant_id", "year", "quarter");
