# Vega Roadmap & Backlog

## Priority 1: Microsoft Planner Integration for Big Rock Tasks
**Status**: Design Complete - Ready to Build

Publishing Big Rock tasks to Microsoft Planner with three options:
1. Attach to existing Teams channel with Planner
2. Create new channel in existing Team
3. Create new Team + Channel + Planner plan

**Implementation Details**:
- `bigRockPlannerMappings` table: id, bigRockId, tenantId, teamId, channelId, planId, bucketId, lastSyncedAt
- Bidirectional Sync: Vega → Planner and Planner → Vega
- Reference: Use Constellation's planner-service.ts patterns

---

## Priority 2: Ambitions Module
**Status**: Design In Progress

Add 3-5 year strategic targets (Ambitions) as a new layer above Annual Goals in Foundations.

**Decisions Made**:
- Optional explicit linking from Annual Goals to Ambitions
- Optional closing note when closing an Ambition
- Optional owner (organization-wide by default)
- Single target year (e.g., 2028)
- Soft limit with warning if >5 active Ambitions

**Ambition Type**:
```
{
  id: string (UUID)
  title: string
  description?: string
  targetYear: number
  linkedValueTitles?: string[]
  ownerId?: string
  status: 'active' | 'closed'
  closedAt?: Date
  closedNote?: string
}
```

**Updated AnnualGoal Type**:
```
{
  title: string
  year: number
  description?: string
  linkedAmbitionId?: string  // NEW - optional link to parent Ambition
}
```

**Implementation Tasks**:
1. Add `ambitions` JSONB field to foundations table
2. Update AnnualGoal type with linkedAmbitionId
3. Build Ambitions UI in Foundations page
4. Update Company OS chart to show Ambitions layer
5. Update exports/MCP to include Ambitions

---

## Priority 3: Support Tickets & Feedback
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

## Priority 4: M365 Copilot Studio + MCP Integration
**Status**: Design In Progress

Enable Vega data access through M365 Copilot via Copilot Studio → MCP Server pattern.

---

## Future Backlog Items
- Enhanced AI-powered OKR recommendations
- Additional M365 integrations (SharePoint document linking)
- Advanced reporting and analytics dashboards
- Mobile-responsive improvements
