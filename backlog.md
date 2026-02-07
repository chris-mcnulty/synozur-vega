# Vega Roadmap & Backlog

Last Updated: February 7, 2026

---

## Recently Completed

### What's New & Changelog (v1.8)
**Status**: COMPLETE (v1.8 - February 7, 2026)

- What's New modal with AI-powered summaries shown on login after new releases
- First-time user detection (skips modal, shows Launchpad welcome instead)
- Tenant admin toggle for "Show What's New on Login" in General settings
- Full Changelog page at `/changelog` with markdown rendering, search, table of contents, and scroll-to-top
- Changelog accessible from sidebar navigation

### Annual Goals Move to Outcomes (v1.8)
**Status**: COMPLETE (v1.8 - February 7, 2026)

- Annual Goals moved from Foundations to Outcomes module
- All functionality preserved: AI suggestions, ambition linking, cloning, year selectors

### Performance Optimizations (v1.8)
**Status**: COMPLETE (v1.8 - February 7, 2026)

- Executive Dashboard batch key results fetch (eliminates N+1 queries)
- Storage batch methods: `getKeyResultsByObjectiveIds`, `getCheckInsByEntityIds`
- In-memory query cache with 60-second TTL and automatic invalidation on writes
- Report generation and COS export use batch queries

### Job Scheduler Enhancements (v1.8)
**Status**: COMPLETE (v1.8 - February 7, 2026)

- Kill stuck job runs with confirmation dialog and audit trail (killedByUserId, killedAt)
- Schedule editing with presets from every minute to daily intervals (vega_admin only)
- resultSummary JSONB field for structured execution results

### Ambitions Module (v1.7)
**Status**: COMPLETE (v1.7 - February 2, 2026)

- `ambitions` JSONB field added to foundations table
- Ambitions UI in Foundations page with add/edit/close/reopen
- Active/Closed filtering via Tabs component
- Value linking (multi-select from org values)
- Target year selection (3-10 years from current)
- Soft limit warning at >5 active ambitions
- Annual Goals can link to parent Ambitions
- MCP tools: `get_ambitions` and enhanced `get_annual_goals` with `includeAmbitions`
- OpenAPI spec updated with Ambition/AnnualGoal schemas

**Remaining Enhancements** (Future):
- Company OS Dashboard chart update to show Ambitions layer
- PDF report inclusion of Ambitions

---

## Priority 1: Microsoft Planner Integration for Big Rock Tasks
**Status**: Design Complete - Ready to Build

Publishing Big Rock tasks to Microsoft Planner with three options:
1. Attach to existing Teams channel with Planner
2. Create new channel in existing Team
3. Create new Team + Channel + Planner plan

**Implementation Details**:
- `bigRockPlannerMappings` table: id, bigRockId, tenantId, teamId, channelId, planId, bucketId, lastSyncedAt
- Bidirectional Sync: Vega → Planner and Planner → Vega
- Status mapping already in place: Open=0%, In Progress=50%, Completed=100%
- Reference: Use Constellation's planner-service.ts patterns

**Prerequisites Built**:
- Big Rock Tasks feature complete (v1.5) with full CRUD, RBAC, status workflow
- Task count badges on Big Rock cards
- Planner task ID field (`plannerTaskId`) already on bigRockTasks table

---

## Priority 2: Support Tickets & Feedback
**Status**: Design Complete

**Support Tickets**:
- Both vega_admin and support_agent roles handle tickets
- Email notifications only (SendGrid)
- Admin-configurable Planner sync (optional)
- Auto-fill contact details with override
- Screenshots via Object Storage
- Master app registry for multi-app support

**Feedback**:
- NPS-style scoring (0-10)
- Always tied to user
- Suggestions reviewed for backlog

**Build-time Questions**:
1. Max file size and attachment limits for screenshots?
2. Ticket category options beyond bug/feature_request/question/other?
3. NPS submission frequency limits?
4. Support agent scope: tenant-scoped or global?

---

## Priority 3: M365 Copilot Studio + MCP Integration
**Status**: Design In Progress

Enable Vega data access through M365 Copilot via Copilot Studio → MCP Server pattern.

**Already Built**:
- MCP Server at `/mcp` endpoint with 13 tools (10 read, 3 write)
- JWT-based auth with scope-based permissions
- API key management with rotation and IP allowlisting
- OpenAPI spec available at `/openapi.yaml` and `/openapi.json`
- Copilot Agent manifests in `/public/copilot-agent/`

---

## Future Backlog Items

### Platform Enhancements
- Company OS Dashboard chart update to show Ambitions layer
- PDF report inclusion of Ambitions
- Enhanced AI-powered OKR recommendations
- Advanced reporting and analytics dashboards
- Mobile-responsive improvements

### Integrations
- Additional M365 integrations (SharePoint document linking)
- Bidirectional Planner sync for Big Rock Tasks (Priority 1)

### Known Issues
- Outcomes page intermittent black screen with Excel autosync (under investigation)
