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
**Status**: ✅ COMPLETE (v1.7)

Add 3-5 year strategic targets (Ambitions) as a new layer above Annual Goals in Foundations.

**Implemented Features**:
- ✅ `ambitions` JSONB field added to foundations table
- ✅ Ambitions UI in Foundations page with add/edit/close/reopen
- ✅ Active/Closed filtering via Tabs component
- ✅ Value linking (multi-select from org values)
- ✅ Target year selection (3-10 years from current)
- ✅ Soft limit warning at >5 active ambitions
- ✅ Annual Goals can link to parent Ambitions
- ✅ MCP tools: `get_ambitions` and enhanced `get_annual_goals` with `includeAmbitions`
- ✅ OpenAPI spec updated with Ambition/AnnualGoal schemas
- ✅ User Guide updated with Ambitions documentation
- ✅ replit.md updated with Ambitions module documentation

**Data Model**:
```
Ambition {
  id: string (UUID)
  title: string
  description?: string
  targetYear: number
  linkedValueTitles?: string[]
  status: 'active' | 'closed'
  closedAt?: Date
  closedNote?: string
  createdAt: Date
}

AnnualGoal {
  title: string
  year: number
  description?: string
  linkedAmbitionId?: string  // optional link to parent Ambition
}
```

**Remaining Work** (Future Enhancements):
- Company OS Dashboard chart update to show Ambitions layer
- PDF report inclusion of Ambitions

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
