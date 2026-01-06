-- PERFORMANCE: Add indexes for frequently queried columns
-- This migration adds indexes to improve query performance for common operations

-- ============================================
-- OBJECTIVES indexes
-- ============================================
-- Most common query: filter by tenant, year, quarter
CREATE INDEX IF NOT EXISTS idx_objectives_tenant_year_quarter 
ON objectives(tenant_id, year, quarter);

-- Parent lookup for hierarchy building
CREATE INDEX IF NOT EXISTS idx_objectives_parent_id 
ON objectives(parent_id) WHERE parent_id IS NOT NULL;

-- Status filtering
CREATE INDEX IF NOT EXISTS idx_objectives_status 
ON objectives(status);

-- Team-based queries
CREATE INDEX IF NOT EXISTS idx_objectives_team_id 
ON objectives(team_id) WHERE team_id IS NOT NULL;

-- ============================================
-- KEY_RESULTS indexes
-- ============================================
-- Most common query: get all KRs for an objective
CREATE INDEX IF NOT EXISTS idx_key_results_objective_id 
ON key_results(objective_id);

-- Tenant-wide KR queries
CREATE INDEX IF NOT EXISTS idx_key_results_tenant_id 
ON key_results(tenant_id);

-- ============================================
-- CHECK_INS indexes
-- ============================================
-- Most common query: get check-ins for an entity
CREATE INDEX IF NOT EXISTS idx_check_ins_entity 
ON check_ins(entity_type, entity_id);

-- Tenant filtering with date ordering
CREATE INDEX IF NOT EXISTS idx_check_ins_tenant_date 
ON check_ins(tenant_id, as_of_date DESC);

-- ============================================
-- BIG_ROCKS indexes
-- ============================================
-- Filter by tenant, year, quarter
CREATE INDEX IF NOT EXISTS idx_big_rocks_tenant_year_quarter 
ON big_rocks(tenant_id, year, quarter);

-- Objective/KR relationship lookup
CREATE INDEX IF NOT EXISTS idx_big_rocks_objective_id 
ON big_rocks(objective_id) WHERE objective_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_big_rocks_key_result_id 
ON big_rocks(key_result_id) WHERE key_result_id IS NOT NULL;

-- ============================================
-- USERS indexes
-- ============================================
-- Tenant-based user listings
CREATE INDEX IF NOT EXISTS idx_users_tenant_id 
ON users(tenant_id) WHERE tenant_id IS NOT NULL;

-- Email verification token lookup (security)
CREATE INDEX IF NOT EXISTS idx_users_verification_token 
ON users(verification_token) WHERE verification_token IS NOT NULL;

-- Reset token lookup (security)
CREATE INDEX IF NOT EXISTS idx_users_reset_token 
ON users(reset_token) WHERE reset_token IS NOT NULL;

-- ============================================
-- MEETINGS indexes
-- ============================================
-- Tenant-based meeting listings
CREATE INDEX IF NOT EXISTS idx_meetings_tenant_id 
ON meetings(tenant_id);

-- Date-based queries
CREATE INDEX IF NOT EXISTS idx_meetings_date 
ON meetings(date DESC) WHERE date IS NOT NULL;

-- ============================================
-- AI_USAGE_LOGS indexes
-- ============================================
-- Tenant usage queries with date filtering
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_tenant_date 
ON ai_usage_logs(tenant_id, created_at DESC);

-- Feature-based analytics
CREATE INDEX IF NOT EXISTS idx_ai_usage_logs_feature 
ON ai_usage_logs(feature);

-- ============================================
-- PAGE_VISITS indexes (analytics)
-- ============================================
-- Date-based analytics
CREATE INDEX IF NOT EXISTS idx_page_visits_visited_at 
ON page_visits(visited_at DESC);

-- Page-based filtering
CREATE INDEX IF NOT EXISTS idx_page_visits_page 
ON page_visits(page);

-- ============================================
-- STRATEGIES indexes
-- ============================================
-- Tenant-based strategy listings
CREATE INDEX IF NOT EXISTS idx_strategies_tenant_id 
ON strategies(tenant_id);

-- ============================================
-- LINK TABLES indexes
-- ============================================
-- Objective-BigRock links
CREATE INDEX IF NOT EXISTS idx_objective_big_rocks_objective 
ON objective_big_rocks(objective_id);

CREATE INDEX IF NOT EXISTS idx_objective_big_rocks_big_rock 
ON objective_big_rocks(big_rock_id);

-- KeyResult-BigRock links
CREATE INDEX IF NOT EXISTS idx_key_result_big_rocks_key_result 
ON key_result_big_rocks(key_result_id);

CREATE INDEX IF NOT EXISTS idx_key_result_big_rocks_big_rock 
ON key_result_big_rocks(big_rock_id);

-- Objective-PlannerTask links
CREATE INDEX IF NOT EXISTS idx_objective_planner_tasks_objective 
ON objective_planner_tasks(objective_id);

-- ============================================
-- GRAPH_TOKENS indexes
-- ============================================
-- User token lookup (used frequently for M365 integration)
CREATE INDEX IF NOT EXISTS idx_graph_tokens_user_service 
ON graph_tokens(user_id, service);

-- ============================================
-- GROUNDING_DOCUMENTS indexes
-- ============================================
-- Active documents lookup
CREATE INDEX IF NOT EXISTS idx_grounding_docs_active 
ON grounding_documents(is_active, tenant_id);

-- ============================================
-- TEAMS indexes
-- ============================================
-- Tenant-based team listings
CREATE INDEX IF NOT EXISTS idx_teams_tenant_id 
ON teams(tenant_id);

-- ============================================
-- GIN indexes for JSONB array containment
-- ============================================
-- Tenants allowed_domains array search (used in getTenantByDomain)
CREATE INDEX IF NOT EXISTS idx_tenants_allowed_domains 
ON tenants USING GIN (allowed_domains);
