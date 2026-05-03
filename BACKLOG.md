# Vega Platform Master Backlog

**Last Updated:** May 2026 (Version 1.11 shipped — Galaxy Portal trust + portal_user role, live meeting mode, soft delete & trash, global search, in-app notification center, bulk reassignment, mobile-responsive OKR tables, daily progress snapshots, check-in draft auto-save, recursive CTE hierarchy loader, combined-context dashboard API, objective tree depth-cap alerts with tests)

> **Note:** This is the single source of truth for all Vega feature proposals, implementation plans, UX enhancements, known issues, and technical decisions. All coding agents should reference this document for backlog-related questions.

---

## TABLE OF CONTENTS

1. [Executive Summary & Priority Sequence](#executive-summary--priority-sequence)
2. [High Priority Features](#high-priority-features)
3. [Medium Priority Features](#medium-priority-features)
4. [Lower Priority / Future Features](#lower-priority--future-features)
5. [UX Enhancements](#ux-enhancements)
6. [Feature Proposals](#feature-proposals)
7. [Business Success Optimization](#business-success-optimization)
8. [Known Issues & Bugs](#known-issues--bugs)
9. [Technical Decisions](#technical-decisions)
10. [Completed Features](#completed-features)

---

## EXECUTIVE SUMMARY & PRIORITY SEQUENCE

### Current Status Assessment (April 8, 2026)

| Item | Status | Notes |
|------|--------|-------|
| **RBAC** | ✅ 100% | Complete. Fine-grained permissions implemented. |
| **M365 Multi-Tenant** | ✅ ~95% | SSO, Planner (Priority 1 complete with auto-sync), SharePoint/OneDrive, Admin Consent, Outlook Calendar complete. |
| **Focus Rhythm** | ✅ ~85% | Decisions/Risks UI, OKR linking, meeting templates complete. |
| **Culture & Values** | ✅ Complete | |
| **M365 Copilot Agent** | ~60% | OpenAPI spec ✅, Declarative manifest ✅, API plugin ✅, OAuth setup pending |
| **Help Chatbot & Support** | ✅ Complete | AI-powered help grounded on user guide + full ticketing system |
| **AI-Powered Assistance** | ~40% | 7 AI tools implemented. Q&A chat with function calling works. |
| **AI Usage Reporting** | ✅ Complete | Full implementation with Tenant + Platform admin UI |
| **Enhanced Reporting** | ✅ ~95% | PDF + PPTX export complete. AI Period Summary, dynamic date selectors. Snapshot comparison remaining. |
| **Export/Import** | ✅ Complete | |
| **Customizable Branding** | ✅ Complete | Full UI with dark mode logo support |
| **Custom Vocabulary** | ✅ Complete | VocabularyContext + system/tenant overrides |
| **Team Mode** | ✅ Complete | /team route with filtered views |
| **Objective Alignment** | ✅ Complete | alignedToObjectiveIds many-to-many |
| **Team Management** | ✅ Complete | CRUD UI in Tenant Admin, API routes, member management |
| **Launchpad** | ✅ Complete | AI document-to-Company OS generator |
| **OKR Cloning** | ✅ Complete | Clone objectives with scope options |
| **OKR Period Close-Out** | ✅ Complete | Pacific Time detection, closing notes, clone prompts |
| **Organized Navigation** | ✅ Complete | Collapsible sidebar sections |

### Recommended Priority Sequence

```
PHASE 1: M365 Copilot Agent Write Actions (Q2 2026)
├── Extend Copilot Agent with write tools (update KR, add check-in, update big rock)
├── Re-test OAuth + tool registration in M365 dev tenant
└── Client deployment + refinement

PHASE 2: UX Enhancements (Q2 2026)
├── ✅ Unified Time Period Selector (shipped)
├── ✅ Contextual Breadcrumbs (shipped Apr 8, 2026)
├── ✅ OKR Creation Wizard (shipped; finalized Apr 8, 2026 with draft auto-save)
├── Executive Dashboard Personalization (pinned metrics, saved layout)
└── User Lookup for Item Assignment — Big Rocks & Meetings phases

PHASE 3: Advanced Features (Q2–Q3 2026)
├── Strategy Cascade Visualization (2-3 weeks)
├── OKR Health Scoring & Predictive Analytics (3-4 weeks)
├── Cross-Team Dependencies & Collaboration Hub (2-3 weeks)
└── Support Ticket Finishing Pass — Week 1 ✅ Week 2 ✅ (SLA timers + Planner sync remain)
```

---

## HIGH PRIORITY FEATURES

### 1. RBAC Enforcement ✅ COMPLETE

**Status:** Complete (January 1, 2026)  
**Priority:** High  

**What's Built:**
- 6 roles defined: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`
- 20+ permissions defined
- RBAC middleware with role/permission/tenant checking
- All routes protected with authentication
- **Fine-grained permissions (UPDATE_OWN_OKR vs UPDATE_ANY_OKR)**:
  - Server-side: `canUserModifyOKR()` and `canUserDeleteOKR()` helper functions in routes-okr.ts
  - Ownership checks on objective, key result, and big rock update/delete routes
  - Meeting ownership checks (facilitator or attendee can edit/delete)
- **Frontend permission-aware UI**:
  - `usePermissions()` hook in `client/src/hooks/use-permissions.ts`
  - Edit/Delete buttons conditionally hidden in OKRDetailPane and HierarchicalOKRTable
  - Permission checks based on current user, item owner, and item creator

---

### 2. Microsoft 365 Multi-Tenant Integration ✅ ~90% COMPLETE

**Status:** Phase 1 Complete, Minor Enhancements Remaining  
**Priority:** High

**What's Built:**
- Multi-tenant MSAL config with `/common` authority
- Microsoft Entra ID login/callback flow
- JIT user provisioning from SSO
- Tenant mapping via `azureTenantId` or email domain
- SSO policy enforcement
- Planner Integration with OAuth consent
- OneDrive/SharePoint file picker
- Admin consent endpoints
- Outlook Calendar sync

**Remaining:**
- Excel data binding for Key Results
- Incremental consent for Mail.Send

---

### 3. M365 Copilot Agent

**Status:** ~60% Complete  
**Priority:** High (CLIENT REQUIREMENT - January 2025)

**What's Built:**
- ✅ OpenAPI 3.0 specification at `/openapi.yaml` and `/openapi.json`
- ✅ Declarative agent manifest (v1.6)
- ✅ API plugin manifest with OAuth config
- ✅ Response formatting helpers in `server/copilot-response-formatter.ts`

**Remaining:**
- OAuth setup in Copilot Studio (pending client Azure AD setup)
- Testing in M365 dev tenant
- Client deployment + refinement

---

### 4. AI-Powered Assistance

**Status:** ~40% Complete  
**Priority:** High

**What's Built:**
- 7 AI tools with function calling
- Streaming chat interface
- Grounding Documents system with tenant-specific context
- AI usage tracking for cost analysis

**Remaining Work:**

#### 4a. Meeting Prep AI
**Effort:** 1 week | **Priority:** High

Automatically generate meeting preparation summaries by analyzing linked OKRs before Focus Rhythm meetings.

| Feature | Description |
|---------|-------------|
| **Pre-Meeting Summary** | Auto-generate bullet points for linked OKRs: progress, blockers, velocity |
| **Talking Points** | Suggest discussion items based on at-risk or stale items |
| **Historical Context** | Include recent check-in notes for each linked OKR |
| **One-Click Generate** | "Prepare for Meeting" button in meeting detail page |

**Implementation:**
- New AI tool: `generateMeetingPrep(meetingId)` 
- Fetches linked OKRs, recent check-ins, pace status
- Returns structured markdown summary
- UI: Add "AI Prep" button to meeting detail page header

---

#### 4b. Predictive Analytics (OKR Completion Forecast)
**Effort:** 2 weeks | **Priority:** High

Forecast OKR completion probability based on historical velocity and time remaining.

| Feature | Description |
|---------|-------------|
| **Completion Probability** | "75% likely to hit target" based on current trajectory |
| **Projected End Value** | "At current pace, will reach 82% by quarter end" |
| **Risk Signals** | Flag objectives with <50% completion probability |
| **Trend Indicators** | Accelerating, steady, or decelerating progress |

**Algorithm (Simple - No ML Required):**
```
velocity = (currentProgress - startProgress) / daysSinceStart
daysRemaining = endDate - today
projectedProgress = currentProgress + (velocity * daysRemaining)
completionProbability = min(100, projectedProgress / targetProgress * 100)
```

**Implementation:**
- Add `calculateCompletionForecast()` helper in `server/lib/okr-intelligence.ts`
- Extend existing pace calculation logic
- New dashboard card: "Forecast Summary" showing completion projections
- Add forecast column to OKR tables (optional toggle)

---

#### 4c. Better AI Tool Chaining
**Effort:** 1 week | **Priority:** Medium

Enable the AI to combine multiple tool calls intelligently to answer complex questions.

| Query Type | Current Behavior | Improved Behavior |
|------------|------------------|-------------------|
| "Which teams are behind and why?" | Returns list of behind items only | Chains: get behind items → get check-ins → summarize blockers |
| "Compare Q3 vs Q4 progress" | Fails or gives generic answer | Chains: get Q3 OKRs → get Q4 OKRs → calculate delta |
| "What should I focus on this week?" | Lists all items randomly | Chains: get at-risk → get behind pace → prioritize by impact |

**Implementation:**
- Enhance system prompt with multi-step reasoning instructions
- Add composite tools: `analyzeTeamHealth()`, `comparePeriods()`, `prioritizeActions()`
- Use GPT-4's native function chaining capabilities
- Track multi-step queries in AI usage logs

---

**Removed from Scope:**
- ~~Vector database for semantic search~~ - Overkill for structured OKR data; PostgreSQL full-text search sufficient. Moved to "Future - Only If Needed"

---

### 5. Executive Dashboard Personalization

**Status:** Committed — on Roadmap (Q2 2026)  
**Priority:** High  
**Effort:** 2-3 weeks

**Overview:**
Allow executives to customize their dashboard experience with layout preferences, threshold settings, and section visibility controls. Personalization settings are stored per-user and persist across sessions.

**Core Features:**

| Feature | Description |
|---------|-------------|
| **Section Visibility** | Show/hide individual dashboard cards (At-Risk, Behind Pace, Winning, Stale, etc.) |
| **Layout Rearrangement** | Drag-and-drop to reorder sections based on personal priority |
| **Threshold Configuration** | Customize thresholds: pace gap %, stale days cutoff, at-risk progress % |
| **Count Limits** | Set how many items to display per section (top 3, 5, 10, all) |
| **Default Filters** | Pre-select teams, quarters, or objective levels to focus on |

**Implementation Approach:**
```
user_dashboard_preferences table:
- userId (FK)
- sectionOrder: string[] (ordered section slugs)
- hiddenSections: string[] (sections to hide)
- thresholds: JSON {paceGap: 10, staleDays: 14, atRiskProgress: 30}
- itemCounts: JSON {atRisk: 5, behindPace: 5, winning: 5}
- defaultFilters: JSON {teamIds: [], quarter: null}
- createdAt, updatedAt
```

**UI Components:**
- Settings gear icon in dashboard header → opens personalization panel
- Drag handles on each card for reordering
- Toggle switches for section visibility
- Slider/input controls for thresholds and counts
- "Reset to Defaults" button

**API Endpoints:**
- `GET /api/user/dashboard-preferences` - Fetch current preferences
- `PATCH /api/user/dashboard-preferences` - Update preferences
- `DELETE /api/user/dashboard-preferences` - Reset to defaults

---

## MEDIUM PRIORITY FEATURES

### Consulting Partner Mode Features

**Status:** Not Started  
**Priority:** Medium  

**Overview:**
Design and implement differentiated features for "Consulting Partner" mode vs "Self-Service" mode. The mode toggle UI infrastructure exists but is currently hidden until features are implemented.

**Proposed Feature Differentiation:**

**Self-Service Mode (Default):**
- Organizations manage their own strategy, OKRs, and check-ins directly
- Standard dashboard views and reporting
- AI assistance for drafting and suggestions

**Consulting Partner Mode:**
- Multi-tenant oversight dashboard for consultants managing multiple clients
- Automation cards for common consulting workflows
- Different default reporting scopes (cross-client views)
- Consultant-specific templates and playbooks
- Client health scoring and engagement metrics
- Bulk operations across client tenants

**Technical Considerations:**
- Mode stored in TenantContext and persisted to localStorage
- ConsultingModeToggle component ready (currently hidden)
- May require consultant-specific role permissions
- Consider whether mode is per-user or per-tenant setting

**Next Steps:**
1. User research: What do consulting partners actually need?
2. Design feature specifications for top 3-5 consultant features
3. Implement incrementally, unhiding toggle when first feature ships

---

### Power BI / Fabric Data Pull Integration

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3-4 weeks

**Overview:**
Pull data FROM Power BI datasets and Microsoft Fabric into Vega to automatically update Key Result progress. Similar to how Excel binding works - connect a KR to a Power BI measure/metric and Vega pulls the value to update progress automatically.

**Use Cases:**
1. **Sales KRs** - Pull revenue metrics from Power BI sales dashboards to update "Achieve $X revenue" KRs
2. **Operations KRs** - Pull SLA metrics, uptime percentages, throughput from operational dashboards
3. **Customer Success KRs** - Pull NPS scores, churn rates, satisfaction metrics from customer analytics
4. **Finance KRs** - Pull margin, cost reduction, budget utilization from financial models
5. **Engineering KRs** - Pull deployment frequency, incident metrics from DevOps dashboards

**Architecture:**

```
┌─────────────────────────────────────────────────────────────────┐
│                 POWER BI → VEGA DATA PULL                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │ Power BI API  │───▶│ Value Extractor  │───▶│ KR Updater   │ │
│  │   (Read)      │    │   (Server)       │    │   (Storage)  │ │
│  └───────────────┘    └──────────────────┘    └──────────────┘ │
│        ▲                     │                      │          │
│        │                     ▼                      ▼          │
│  ┌───────────────┐    ┌──────────────────┐    ┌──────────────┐ │
│  │ Dataset/Report│    │ Transform +      │    │ Check-in     │ │
│  │ Selection     │    │ Map to Target    │    │ Created      │ │
│  └───────────────┘    └──────────────────┘    └──────────────┘ │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Phase 1: Core Data Pull (2 weeks)**

| Component | Description |
|-----------|-------------|
| **Azure AD Setup** | Reuse existing M365 integration credentials (service principal) |
| **Power BI Service** | `server/integrations/powerbi.ts` with authentication + read methods |
| **Dataset Browser** | UI to browse workspaces → datasets → tables → measures |
| **Value Mapping** | Map Power BI measure to KR current value |

**Key Result Binding Schema:**
```json
{
  "keyResultId": "uuid",
  "powerbiBinding": {
    "workspaceId": "guid",
    "workspaceName": "Sales Analytics",
    "datasetId": "guid",
    "datasetName": "Revenue Model",
    "tableOrMeasure": "TotalRevenue",
    "measureType": "measure",  // 'measure' | 'column_aggregate'
    "aggregation": null,       // null for measures, 'sum'|'avg'|'max' for columns
    "filter": null,            // optional DAX filter expression
    "valueMapping": {
      "extractedValue": "number",
      "targetField": "currentValue"  // maps to KR currentValue
    }
  }
}
```

**Power BI Read API Usage:**
```typescript
// Execute DAX query to get measure value
POST https://api.powerbi.com/v1.0/myorg/groups/{workspaceId}/datasets/{datasetId}/executeQueries

{
  "queries": [
    {
      "query": "EVALUATE { [TotalRevenue] }"
    }
  ],
  "serializerSettings": {
    "includeNulls": true
  }
}
```

**Phase 2: Sync Configuration (1 week)**

| Feature | Description |
|---------|-------------|
| **Sync Frequency** | Hourly, Daily, Weekly, or On-Demand per KR |
| **Batch Sync** | Sync all Power BI-bound KRs at once |
| **Manual Trigger** | "Refresh from Power BI" button on KR |
| **Sync Status** | Show last sync time, value, and any errors |
| **Auto Check-in** | Optionally create check-in when value changes |

**Phase 3: Advanced Binding (1 week)**

| Feature | Description |
|---------|-------------|
| **Calculated Mappings** | Apply formula to pulled value (e.g., divide by 1000) |
| **Threshold Alerts** | Notify when Power BI value crosses threshold |
| **Historical Tracking** | Store all pulled values for trend analysis |
| **Multi-Source KRs** | Aggregate from multiple Power BI measures |

**API Endpoints:**
```
GET    /api/integrations/powerbi/workspaces           - List available workspaces
GET    /api/integrations/powerbi/workspaces/:id/datasets - List datasets in workspace
GET    /api/integrations/powerbi/datasets/:id/schema  - Get tables/measures for binding
POST   /api/key-results/:id/powerbi-binding           - Create/update binding
DELETE /api/key-results/:id/powerbi-binding           - Remove binding
POST   /api/key-results/:id/powerbi-sync              - Trigger manual sync
POST   /api/integrations/powerbi/sync-all             - Batch sync all bindings
GET    /api/integrations/powerbi/sync-history         - Sync history log
```

**Database Schema:**
```sql
powerbi_kr_bindings:
  id UUID PRIMARY KEY
  tenantId UUID REFERENCES tenants
  keyResultId UUID REFERENCES key_results
  workspaceId TEXT
  workspaceName TEXT
  datasetId TEXT
  datasetName TEXT
  measureName TEXT
  measureType TEXT         -- 'measure' | 'column_aggregate'
  aggregation TEXT         -- 'sum' | 'avg' | 'max' | 'min' | 'count'
  daxFilter TEXT           -- optional DAX filter
  valueTransform JSONB     -- { formula: 'value / 1000', decimals: 2 }
  syncFrequency TEXT       -- 'hourly' | 'daily' | 'weekly' | 'manual'
  createCheckIn BOOLEAN    -- auto-create check-in on value change
  lastSyncAt TIMESTAMP
  lastSyncValue DECIMAL
  lastSyncStatus TEXT      -- 'success' | 'failed' | 'no_change'
  lastSyncError TEXT
  createdAt TIMESTAMP
  updatedAt TIMESTAMP

powerbi_sync_logs:
  id UUID PRIMARY KEY
  bindingId UUID REFERENCES powerbi_kr_bindings
  keyResultId UUID
  previousValue DECIMAL
  newValue DECIMAL
  status TEXT
  errorMessage TEXT
  durationMs INTEGER
  createdAt TIMESTAMP
```

**Authentication:**
- Leverages existing Azure AD service principal from M365 integration
- Required scope: `https://analysis.windows.net/powerbi/api/Dataset.Read.All`
- User must have access to the datasets they want to bind

**Rate Limits (Power BI API):**
- 120 requests per minute per user
- Vega implements request batching and caching
- Stagger syncs to avoid rate limit issues

**UI: Key Result Detail → Data Source Tab:**
```
Data Source
├── Manual Entry (current default)
├── Excel Binding (existing)
└── Power BI Binding [NEW]
    ├── Workspace: [Dropdown - fetched from API]
    ├── Dataset: [Dropdown - based on workspace]
    ├── Measure/Table: [Dropdown - based on dataset]
    ├── Aggregation: [Sum/Avg/Max/Min - for table columns]
    ├── Filter (optional): [DAX expression input]
    ├── Sync Frequency: [Manual/Hourly/Daily/Weekly]
    ├── Create Check-in on Change: [Toggle]
    └── Transform: [Optional formula like "value / 1000"]
    
    Current Value from Power BI: $1,234,567
    Last Sync: Jan 18, 2026 at 2:00 PM
    [Refresh Now] button
```

**UI: Tenant Admin → Integrations → Power BI:**
```
Power BI Integration
├── Connection Status: Connected via M365
├── Active Bindings: 12 Key Results linked to Power BI
├── Last Batch Sync: Jan 18, 2026 at 3:00 PM
├── [Sync All Now] button
├── Sync Schedule: Daily at 6:00 AM
└── [View Sync History] link
```

**Dependencies:**
- Existing M365 Azure AD credentials (already implemented)
- `@azure/identity` package (already installed)
- User needs Power BI Pro or Premium Per User license

**Business Value:**
- Eliminates manual data entry for metrics tracked in Power BI
- Ensures OKR progress reflects actual business metrics in real-time
- Bridges gap between BI analytics and goal tracking
- Reduces "progress update fatigue" for data-driven KRs

---

### OKR Intelligence (AI Predictions & Pace Tracking)

**Status:** Phase 1 Complete, Phase 2 Ready  
**Priority:** Medium-High  
**First Premium Feature Candidate**

**Overview:**
Predictive trend analysis for OKRs that works from day one with sparse data. Designed to deliver immediate value without requiring years of historical data.

**Phase 1: Pace & Velocity Calculations (COMPLETE - January 9, 2026)**
- [x] Calculate pace status (on-track, ahead, behind) based on time elapsed vs progress
- [x] Display pace indicators on OKR cards/rows (PaceBadge component)
- [x] Behind Pace alerts on Executive Dashboard with severity sorting
- [x] Velocity projection: Shows "→ X%" projected end progress in badges and dashboard
- [x] Simple risk signals: Stalled (0% after 30 days), Attention Needed (14+ days no check-in)
- [x] Risk signal badges displayed on objectives in both Outcomes module and Executive Dashboard

**Phase 2: Trend Visualization**
- Sparkline charts showing progress over time
- Velocity trend (accelerating, steady, decelerating)
- Confidence bands on projections

**Phase 3: Smart Forecasting**
- Pattern matching against OKR archetypes
- Cohort comparison (anonymized cross-tenant benchmarks)
- Anomaly detection for sudden stalls

**Data Requirements:**
- Check-in history with timestamps (already exists in checkIns table)
- Start date, target date for objectives/KRs (exists)
- Current progress values (exists)

**Key Design Principle:** 
Works with 2-3 data points. No ML required for Phase 1 - simple math delivers immediate value.

---

### Premium Feature Gating System

**Status:** Design Complete, Implementation Pending  
**Priority:** Medium  
**Effort:** 2-3 weeks

**Overview:**
Feature entitlement system to gate premium features by service plan. First premium feature: OKR Intelligence.

**Architecture:**
```
features table:
- id, slug, displayName, description, isPremium, category

service_plan_features table (join):
- servicePlanId, featureId, mode: 'enabled' | 'upsell' | 'hidden'

tenant_feature_overrides table:
- For admin exceptions (demos, sales trials)
```

**Feature Modes:**
| Mode | Behavior |
|------|----------|
| `enabled` | Full access |
| `upsell` | Visible with 💎 indicator, click shows upgrade prompt |
| `hidden` | Not shown at all |

**Frontend Components:**
- `useFeature(slug)` hook → returns status + requiredPlan
- `<FeatureGate feature="...">` wrapper component
- 💎 Premium badge on buttons/cards for upsell items
- Upgrade modal with plan comparison

**Backend Enforcement:**
- Middleware/helper checking entitlements before premium operations
- Returns 403 with upgrade metadata if blocked
- Tenant-level overrides for demos/trials

**Example Plan Mapping:**
| Feature | Trial | Team | Unlimited |
|---------|-------|------|-----------|
| Basic OKRs | ✅ | ✅ | ✅ |
| AI OKR Intelligence | 💎 upsell | ✅ | ✅ |

**Dependencies:** OKR Intelligence Phase 1 should ship first to validate the premium model.

---

### Key Result Weighting ✅ COMPLETE

**Status:** Complete (December 31, 2025)  
**Effort:** Complete

**Implementation:**
- Schema has `weight` (default 25) and `isWeightLocked` fields on key_results table
- WeightManager component with auto-balance, normalize, and lock features
- Weight badges displayed in HierarchicalOKRTable with lock indicator
- Weight display in OKRDetailPane for Key Results showing contribution percentage
- Weighted progress calculation in objective rollup
- Weight editing via dialog accessed from objective hover menu

---

### Objective Alignment Visual Indicator (Viva Goals-style)

**Status:** Schema Ready, UI Enhancement Needed  
**Priority:** Low-Medium  
**Effort:** 2-3 days

**Reference:** Viva Goals "Aligned to" display (see attached_assets/IMG_7052_1767222592902.png)

**Description:**
Show a visual indicator when an objective is "aligned to" (ladders up to) a parent objective on a different team or at the organization level. This helps users understand cross-team strategic alignment at a glance.

**What's Already Built:**
- ✅ `alignedToObjectiveIds` field in objectives schema (many-to-many)
- ✅ "Aligned to" section in OKRDetailPane showing aligned objectives
- ✅ Alignment dialog in PlanningEnhanced for setting alignments
- ✅ API support for updating alignments

**Remaining Work:**
1. **Hierarchy Table Indicator**: Add visual badge/icon on objective rows that are aligned to other objectives
2. **Alignment Arrow**: Show ↑ arrow icon with parent objective name on hover
3. **Quick Alignment**: One-click "Align to..." action from objective row menu
4. **Alignment Count Badge**: Show count of aligned children on parent objectives

**UI Reference (Viva Goals):**
- "Aligned to" section with ↑ arrow and parent objective title
- Shows the strategic relationship clearly

**Business Value:**
- Visual clarity on cross-team strategic alignment
- Matches Viva Goals behavior for migrating users
- Helps identify orphaned objectives (not aligned to anything)

**Dependencies:** None (schema already supports this)

---

### Governance & Audit Enhancements

**Status:** Not Started  
**Effort:** 4-5 weeks

Features:
- Audit log for all changes
- Change approval workflows
- Version history
- Compliance reports
- Data retention policies
- GDPR/privacy controls

---

### Strategic Alignment Mind Map

**Status:** Not Started  
**Effort:** 2-3 weeks

Interactive visual graph showing how values, goals, strategies, objectives, KRs, and big rocks interconnect. Uses React Flow.

---

### Dynamic Backlog & Changelog Viewer

**Status:** Not Started  
**Priority:** Low-Medium  
**Effort:** 1-2 days

**Description:**
Expose BACKLOG.md and a changelog file dynamically within the application UI so users and administrators can view upcoming features, known issues, and recent changes without leaving the app.

**Features:**
1. **Backlog Viewer**: Read and render BACKLOG.md as formatted HTML in an admin-accessible page
2. **Changelog Page**: Maintain a CHANGELOG.md and display it for users (version history, release notes)
3. **Access Control**: 
   - Full backlog visible to admins/consultants
   - Condensed "What's New" / release notes visible to all users
4. **Markdown Rendering**: Use existing `react-markdown` package with `remark-gfm` for GitHub-flavored markdown
5. **Navigation**: Add "What's New" or "Release Notes" link in sidebar Personal section

**Technical Approach:**
- API endpoint: `GET /api/docs/:filename` to serve markdown content
- Frontend: New page using `react-markdown` (already installed)
- Role-based filtering for admin-only sections

**Business Value:**
- Transparency on roadmap and upcoming features
- Self-service for users to check release notes
- Reduces support questions about new features
- Professional product experience

**Dependencies:** 
- `react-markdown` (already installed)
- `remark-gfm` (already installed)

---

### Company OS Document Export

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 1-2 weeks

**Description:**
Generate a comprehensive single-document view of an organization's Company OS, exportable as Markdown (with future support for PDF/PPTX). This provides a complete snapshot of the company's strategic framework in a shareable, printable format.

**Features:**
1. **Full Export**: Generate complete document including:
   - Foundation (Mission, Vision, Values, Annual Goals)
   - Strategies with linked values
   - Objectives hierarchy with Key Results and progress
   - Big Rocks with status
   - Team structure (optional)
2. **Filtering Options**:
   - By organizational level (Organization, Division, Team, Individual)
   - By team (specific teams only)
   - By time period (quarter/year)
   - By status (active, completed, all)
3. **Output Formats**:
   - Phase 1: Markdown (.md)
   - Future: PDF, PPTX
4. **Access Control**: Respect RBAC (tenant users see only their tenant)

**Technical Approach:**
- API endpoint: `GET /api/export/company-os` with filter query params
- Server-side markdown generation
- Frontend: Export button in sidebar or Planning page with filter dialog

**Business Value:**
- Board presentations and leadership reviews
- Strategy documentation
- Consultant deliverables
- Archival and compliance

**Dependencies:** None

---

## LOWER PRIORITY / FUTURE FEATURES

### MCP Server Enhancements

**Status:** Backlog  
**Priority:** Low

Optional enhancements for the MCP server:

1. **Connection Testing UI**: Button in Tenant Admin to test that an API key works correctly before copying
2. **Usage Analytics Dashboard**: Dedicated dashboard showing tool usage per key, success/error rates, popular tools
3. **Key Usage Quotas**: Per-key call limits beyond tenant-wide rate limits (e.g., max 1000 calls/day per key)
4. **Additional MCP Tools**: Add more tools as needed (e.g., create OKRs, create Big Rocks, update strategy status)

---

### Advanced AI Features

- Predictive analytics (forecast OKR completion probability)
- Variance detection
- Sentiment analysis on meeting notes
- AI Big Rock suggestions

### Sector-Specific Playbooks

Pre-built Company OS templates for different industries (SaaS, professional services, manufacturing, non-profit).

### Employee Experience & Engagement

Gamification, personal OKRs, progress notifications, mobile app.

---

## UX ENHANCEMENTS

### ✅ Enhancement 4: Organized Navigation (IMPLEMENTED)

**Status:** Complete (December 30, 2025)

Reorganized sidebar navigation into logical, collapsible sections:

```
📊 Execute (Expanded by default)
├─ Company OS Dashboard
└─ Team Mode

🎯 Plan & Align (Expanded by default)
├─ Foundations
├─ Strategy
└─ Planning

📅 Review & Learn (Collapsed by default)
└─ Focus Rhythm

⚙️ Manage (Admin only, Collapsed by default)
├─ Launchpad
├─ Import Data
├─ Reporting
├─ AI Grounding
└─ Tenant Admin

🛡️ Platform (Platform admins only)
└─ System Admin

👤 Personal (Always visible)
├─ My Settings
├─ User Guide
└─ About
```

**Key Features:**
- Collapsible sections with persistent state
- Smart auto-expand for active page
- Role-based visibility
- Smooth 200ms animations

---

### Enhancement 1: Contextual Breadcrumbs with Quick Actions ✅ COMPLETE

**Status:** Shipped (April 8, 2026)  
**Effort:** 1 week  
**Priority:** High

Display navigation path with interactive elements. Implemented as
`client/src/components/ContextualBreadcrumbs.tsx` and integrated into
`ModuleLayout` in `client/src/App.tsx`.

Shipped features:
- Route-aware breadcrumb trail derived from the current wouter path
- Type indicators (lucide icons) on each segment
- Smart truncation for long paths — first segment + last two segments visible,
  middle segments collapsed into an ellipsis dropdown
- Quick-action dropdown menus on section-root segments (Planning, Focus
  Rhythm, Administration, About) that jump to sibling pages
- Honors the existing shadcn `breadcrumb` primitive for styling consistency

---

### Enhancement 2: Unified Time Period Selector

**Status:** Completed  
**Effort:** 1 week  
**Priority:** Critical

Global time period component in header:
- Consistent quarter/year selection across modules ✓
- Persistent selection as user navigates ✓
- Quick shortcuts (Current Quarter, Previous Quarter) ✓
- Multi-period selection with clear multi ✓
- Annual mode support ✓
- Tenant-aware defaults ✓
- Annual Goals and Alignment Goal year filters sync to global period ✓

---

### Enhancement 3: Streamlined OKR Creation Wizard ✅ COMPLETE

**Status:** Shipped (finalized April 8, 2026)  
**Effort:** 2 weeks  
**Priority:** High

Multi-step wizard: Objective → Key Results → Big Rocks → Review. Implemented
as `client/src/components/okr/OKRCreationWizard.tsx` and launched from the
"OKR Wizard" button on `client/src/pages/PlanningEnhanced.tsx` (header
toolbar, left of "Add Objective").

Shipped features:
- ✅ Create complete OKR hierarchy (objective + KRs + big rocks) in one session
- ✅ Step indicator with completed/active/pending states
- ✅ Review step with per-section summary before submit
- ✅ Tenant-scoped query invalidation via `invalidateOKRQueries()` helper
- ✅ Draft auto-save to `localStorage` keyed by `okr-wizard-draft:{tenantId}` —
  survives closing the dialog, clears on successful submit or explicit discard
- ✅ "Resumed from a saved draft" banner with Discard button on reopen

Deferred to future enhancement (not blocking completion):
- AI suggestions integrated throughout each step (uses existing AI tools)
- Template library (save wizard inputs as a reusable starting point)

---

### Enhancement 5: Unified Relationships Panel

**Status:** Documented, Not Implemented  
**Effort:** 2-3 weeks  
**Priority:** Medium

"Relationships" tab on all entity detail views:
- Visual relationship graph
- Quick link/unlink without modals
- Relationship warnings and AI suggestions

---

### Multi-Select Time Period Filter

**Status:** Backlogged  
**Priority:** Medium

Standardized multi-select time period picker allowing selection of multiple quarters/years simultaneously. Reference: Viva Goals time period selector.

---

### User Lookup for Item Assignment

**Status:** Committed — on Roadmap (Q2 2026)  
**Priority:** High  
**Effort:** 1 week  
**Added:** January 11, 2026

**Description:**
Replace manual email entry with a searchable user picker when assigning owners to OKRs and other items. Users can search by name or email against the current tenant's user directory.

**Scope - Phase 1:**
- Objectives: Owner assignment
- Key Results: Owner assignment

**Future Phases:**
- Big Rocks: Owner assignment
- Meetings: Facilitator and attendee selection
- Teams: Member management

**Features:**
1. **Searchable Dropdown:** Type-ahead search filtering users by name or email
2. **User Display:** Show avatar, name, and email in dropdown options
3. **Tenant Scoped:** Only shows users within the current tenant
4. **Fallback to Email:** Option to manually enter email if user not found (for inviting new users)
5. **Recent Selections:** Show recently assigned users at top for quick access

**Technical Approach:**
- API endpoint: `GET /api/users/search?q=<query>&tenantId=<id>`
- Frontend: Reusable `UserPicker` component using Combobox pattern
- Integration with existing user table and tenant filtering

**Business Value:**
- Reduces typos in email entry
- Faster assignment workflow
- Better discoverability of team members
- Consistent user experience across the platform

---

## FEATURE PROPOSALS

### Help Chatbot & Support Ticket System ✅ COMPLETE

**Status:** Complete (February 8, 2026)  
**Effort:** 2-3 weeks  
**Priority:** High (User Experience Critical)  
**Added:** January 5, 2026

A two-part integrated help system: (1) an AI-powered Help Bot grounded on the Vega user guide, and (2) a Support Ticket system for escalation and feedback. See COMPLETED FEATURES section for implementation details.

#### Feature 1: Help Chatbot (Primary)

**Purpose:** Provide instant, context-aware help to users by answering questions based on the official Vega user guide documentation.

**User Experience:**
```
┌─────────────────────────────────────────────────────────────┐
│  [?] Help button in header/sidebar (always visible)         │
│      └── Opens slide-out chat panel or modal                │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  🌟 Vega Help                                    [X] │   │
│  │  ─────────────────────────────────────────────────── │   │
│  │                                                      │   │
│  │  Hi! I'm your Vega assistant. Ask me anything       │   │
│  │  about using the platform.                          │   │
│  │                                                      │   │
│  │  💡 Quick topics:                                   │   │
│  │  • How do I create an OKR?                          │   │
│  │  • What is a Big Rock?                              │   │
│  │  • How do check-ins work?                           │   │
│  │                                                      │   │
│  │  ─────────────────────────────────────────────────── │   │
│  │  [Type your question...]              [Send] [📎]   │   │
│  │                                                      │   │
│  │  ─────────────────────────────────────────────────── │   │
│  │  Can't find what you need?                          │   │
│  │  [Open Support Ticket]                              │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

**Technical Implementation:**
1. **Grounding Documents:**
   - Store user guide content as grounding documents (similar to existing Background Context system)
   - System-level documents that apply to all tenants
   - Chunk and index for efficient retrieval (RAG pattern)

2. **AI Integration:**
   - Use existing OpenAI integration with system prompt including user guide context
   - Streaming responses for better UX
   - Include current page/context for more relevant answers

3. **Conversation Memory:**
   - Maintain conversation history within session
   - Option to clear/restart conversation

4. **Escalation Path:**
   - If user expresses frustration or bot can't answer after 2-3 attempts
   - Show "Would you like to open a support ticket?" prompt
   - Pre-fill ticket with conversation summary

**Database Schema:**
```typescript
// Help conversations (optional - for analytics)
helpConversations: {
  id: uuid,
  tenantId: uuid,
  userId: uuid,
  messages: jsonb, // Array of {role, content, timestamp}
  resolved: boolean,
  escalatedToTicket: boolean,
  ticketId: uuid | null,
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

---

#### Feature 2: Support Ticket System (Secondary)

**Purpose:** Capture user feedback, bug reports, and support requests that can't be resolved by the Help Bot.

**User Experience:**
```
┌─────────────────────────────────────────────────────────────┐
│  Open Support Ticket                                        │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  📋 Category:                                               │
│  [▼ Bug Report | Feature Request | Question | Feedback ]   │
│                                                             │
│  📝 Subject:                                                │
│  [Short description of your issue...]                       │
│                                                             │
│  📄 Description:                                            │
│  [Detailed description...]                                  │
│  (Pre-filled with conversation summary if from Help Bot)    │
│                                                             │
│  📎 Attachments: [Add Screenshot] [Add File]                │
│                                                             │
│  🔢 Priority: [Low | Medium | High]                         │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  [Cancel]                              [Submit Ticket]      │
└─────────────────────────────────────────────────────────────┘
```

**On Ticket Submission:**
1. **Acknowledgment Email to User:**
   - Subject: "Vega Support Ticket #[ID] - We've received your request"
   - Body: Ticket details, expected response time, ticket tracking link
   - Sent via SendGrid (already integrated)

2. **Internal Notification to Support:**
   - Email to Chris.McNulty@synozur.com
   - Subject: "New Vega Support Ticket #[ID] from [User] at [Tenant]"
   - Body: Full ticket details, user info, conversation history if applicable
   - Include direct link to admin ticket view

3. **In-App Ticket Tracking:**
   - Users can view their submitted tickets
   - Status updates (Open → In Progress → Resolved → Closed)
   - Reply thread for back-and-forth communication

**Database Schema:**
```typescript
supportTickets: {
  id: uuid,
  ticketNumber: serial, // Human-readable ticket number
  tenantId: uuid,
  userId: uuid,
  category: enum ['bug', 'feature_request', 'question', 'feedback'],
  subject: text,
  description: text,
  priority: enum ['low', 'medium', 'high'],
  status: enum ['open', 'in_progress', 'resolved', 'closed'],
  helpConversationId: uuid | null, // Link to originating conversation
  metadata: jsonb, // Browser info, current page, etc.
  createdAt: timestamp,
  updatedAt: timestamp,
  resolvedAt: timestamp | null,
  resolvedBy: uuid | null,
}

supportTicketReplies: {
  id: uuid,
  ticketId: uuid,
  userId: uuid, // Can be user or admin
  isInternal: boolean, // Internal notes vs user-visible replies
  content: text,
  createdAt: timestamp,
}

supportTicketAttachments: {
  id: uuid,
  ticketId: uuid,
  fileName: text,
  fileUrl: text,
  fileSize: integer,
  mimeType: text,
  uploadedAt: timestamp,
}
```

**API Routes:**
```
POST /api/support/tickets - Create new ticket
GET /api/support/tickets - List user's tickets
GET /api/support/tickets/:id - Get ticket details
POST /api/support/tickets/:id/replies - Add reply
PATCH /api/support/tickets/:id - Update status (admin)

POST /api/help/conversations - Start help conversation
POST /api/help/conversations/:id/messages - Send message to help bot
POST /api/help/conversations/:id/escalate - Escalate to ticket
```

**Admin View (Vega Admin/Consultant):**
- Dashboard showing all open tickets across tenants
- Filter by status, priority, category, tenant
- Assign tickets to team members
- Internal notes and reply functionality
- Bulk actions (close, assign, update priority)

**Email Templates:**

*User Acknowledgment:*
```
Subject: Vega Support Ticket #{{ticketNumber}} - We've received your request

Hi {{userName}},

Thank you for contacting Vega Support. We've received your {{category}} 
and a member of our team will review it shortly.

Ticket Details:
- Ticket #: {{ticketNumber}}
- Subject: {{subject}}
- Priority: {{priority}}
- Status: Open

You can track your ticket status in Vega by visiting:
{{ticketUrl}}

We typically respond within 1 business day.

Best regards,
The Vega Team
```

*Internal Notification:*
```
Subject: [Vega Support] New {{priority}} {{category}} from {{userName}} ({{tenantName}})

New support ticket submitted:

Ticket #: {{ticketNumber}}
User: {{userName}} ({{userEmail}})
Tenant: {{tenantName}}
Category: {{category}}
Priority: {{priority}}

Subject: {{subject}}

Description:
{{description}}

{{#if helpConversation}}
Previous Help Bot Conversation:
{{helpConversation}}
{{/if}}

View ticket: {{adminTicketUrl}}
```

**Implementation Notes:**
- Use existing SendGrid integration for emails
- Help Bot should use the same AI infrastructure as existing AI chat
- Consider rate limiting on ticket creation (max 5 per hour per user)
- Automatically capture context: current page, browser, tenant, timestamp
- Store tickets per-tenant but make visible to Vega admins globally

---

### AI Check-in Note Rewriter ✅ COMPLETE

**Status:** Complete (January 2026)  
**Effort:** 3-5 days  
**Priority:** Medium (AI Enhancement)  
**Added:** January 5, 2026

AI-powered feature that helps users write better, more professional check-in notes by rewriting their input based on the current value, context, and OKR details.

#### User Experience

```
┌─────────────────────────────────────────────────────────────┐
│  Check-in for: Increase MRR to $500K                        │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Current: $425,000  →  New Value: [_$450,000_]              │
│                                                             │
│  📝 Note:                                                   │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ got some new customers this week                    │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [✨ AI Rewrite]  [Improve Clarity]  [Make Concise]        │
│                                                             │
│  ─────────────────────────────────────────────────────────  │
│  AI Suggestion:                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ Closed 3 new enterprise accounts this week,         │   │
│  │ adding $25K MRR. Progress: 90% toward Q1 target.    │   │
│  │ On track to exceed goal by end of month.            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  [Accept]  [Edit & Accept]  [Regenerate]  [Dismiss]        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

#### Rewrite Modes

| Mode | Purpose | Example Output |
|------|---------|----------------|
| **AI Rewrite** | Full rewrite with professional tone | Detailed, contextual note |
| **Improve Clarity** | Keep meaning, improve grammar/structure | Same info, clearer writing |
| **Make Concise** | Shorten while preserving key points | Brief, punchy update |
| **Add Context** | Expand with relevant metrics/status | Original + progress context |

#### Context Provided to AI

The AI rewriter receives rich context to generate relevant suggestions:

```typescript
interface CheckInRewriteContext {
  // Current check-in data
  originalNote: string;
  previousValue: number | null;
  newValue: number;
  
  // Key Result context
  krTitle: string;
  krDescription: string | null;
  targetValue: number;
  startValue: number;
  unit: string;
  metricType: 'number' | 'percentage' | 'currency' | 'binary';
  
  // Objective context
  objectiveTitle: string;
  objectiveDescription: string | null;
  
  // Progress context
  currentProgress: number; // 0-100%
  progressDelta: number;   // Change from this check-in
  
  // Time context
  daysRemaining: number;
  quarterName: string;     // e.g., "Q1 2026"
  
  // Historical context (optional)
  recentCheckIns: Array<{
    date: string;
    value: number;
    note: string;
  }>;
  
  // Rewrite mode
  mode: 'full' | 'clarity' | 'concise' | 'expand';
}
```

#### AI Prompt Strategy

**System Prompt:**
```
You are an expert at writing professional OKR check-in notes. 
Your task is to rewrite or improve check-in notes based on the 
context provided. Notes should be:
- Specific and data-driven when possible
- Professional but conversational
- Include progress context relative to the goal
- Highlight blockers or wins when relevant
- Be appropriately brief (1-3 sentences typically)
```

**User Prompt Template:**
```
Rewrite this check-in note for a Key Result.

Key Result: {{krTitle}}
Target: {{targetValue}} {{unit}}
Current Progress: {{previousValue}} → {{newValue}} ({{progressDelta}}% change)
Overall Progress: {{currentProgress}}% toward goal
Time Remaining: {{daysRemaining}} days in {{quarterName}}

Original Note: "{{originalNote}}"

Mode: {{mode}}

Provide an improved version of this note.
```

#### API Endpoint

```
POST /api/ai/rewrite-checkin
{
  "keyResultId": "uuid",
  "originalNote": "string",
  "newValue": number,
  "mode": "full" | "clarity" | "concise" | "expand"
}

Response:
{
  "rewrittenNote": "string",
  "suggestions": ["alternative1", "alternative2"], // optional alternatives
  "tokensUsed": number
}
```

#### Integration Points

1. **OKRDetailPane Check-in Dialog:**
   - Add "AI Rewrite" button next to the note textarea
   - Show AI suggestion in a preview area below
   - Accept/Edit/Regenerate controls

2. **Bulk Check-in Flow:**
   - Option to AI-rewrite notes during bulk updates
   - "Improve All Notes" action for multiple check-ins

3. **Meeting Check-in:**
   - Quick rewrite during Focus Rhythm meeting prep
   - Batch mode for all team KR updates

#### UI Components

```typescript
// New component
interface AIRewriteButtonProps {
  originalNote: string;
  onRewrite: (rewrittenNote: string) => void;
  context: CheckInRewriteContext;
}

// Add to CheckInDialog
<div className="flex gap-2 mt-2">
  <Button variant="ghost" size="sm" onClick={() => rewrite('full')}>
    <Sparkles className="w-4 h-4 mr-1" />
    AI Rewrite
  </Button>
  <Button variant="ghost" size="sm" onClick={() => rewrite('clarity')}>
    Improve Clarity
  </Button>
  <Button variant="ghost" size="sm" onClick={() => rewrite('concise')}>
    Make Concise
  </Button>
</div>

{aiSuggestion && (
  <div className="mt-3 p-3 bg-muted rounded-md">
    <p className="text-sm text-muted-foreground mb-2">AI Suggestion:</p>
    <p className="text-sm">{aiSuggestion}</p>
    <div className="flex gap-2 mt-2">
      <Button size="sm" onClick={acceptSuggestion}>Accept</Button>
      <Button size="sm" variant="outline" onClick={editAndAccept}>
        Edit & Accept
      </Button>
      <Button size="sm" variant="ghost" onClick={regenerate}>
        Regenerate
      </Button>
    </div>
  </div>
)}
```

#### Business Value

- **Time Savings:** Users spend less time crafting professional updates
- **Consistency:** More uniform, high-quality check-in notes across the org
- **Better Reporting:** Clearer notes improve readability in reports/exports
- **User Adoption:** AI assistance reduces friction in the check-in process
- **Context Awareness:** Notes automatically reference progress and timelines

#### Implementation Notes

- Use existing OpenAI integration (streaming optional for single rewrites)
- Track AI usage for cost monitoring (existing aiUsageLogs table)
- Consider caching common patterns to reduce API calls
- Rate limit: Max 10 rewrites per user per hour
- Graceful fallback if AI service unavailable

---

### Tenant Snapshot & Recovery System

**Status:** Designed, Not Implemented  
**Effort:** 3-4 weeks  
**Priority:** Medium-High (Premium Feature)  
**Added:** January 7, 2026

A premium feature that automatically backs up tenant data daily, keeping up to 90 days of history for data recovery. Only available to tenants with qualifying service plans.

#### Overview

Daily automated snapshots of tenant data with point-in-time recovery capabilities, enabling tenants to restore their data to any previous day within the retention window.

#### Database Schema Additions

**New Tables:**

```typescript
// Service plans with feature flags
servicePlans: {
  id: uuid,
  name: text,                    // "Free", "Standard", "Premium"
  includesSnapshotService: boolean,
  maxSnapshotRetentionDays: integer,  // 0, 30, or 90
  maxStorageBytes: bigint,
  monthlyPrice: decimal,
  createdAt: timestamp,
}

// Tenant table addition
tenants: {
  // ... existing fields
  servicePlanId: uuid FK -> servicePlans.id,
}

// Snapshot metadata
tenantSnapshots: {
  id: uuid,
  tenantId: uuid FK,
  snapshotDate: date,
  status: text,                  // "pending", "in_progress", "completed", "failed"
  sizeBytes: bigint,
  storageUrl: text,              // S3/Azure Blob URL
  checksum: text,                // SHA-256 for integrity
  encryptionKeyId: text,
  expiresAt: timestamp,
  createdAt: timestamp,
}

// What's included in each snapshot
tenantSnapshotItems: {
  id: uuid,
  snapshotId: uuid FK,
  domain: text,                  // "foundations", "strategies", "objectives", etc.
  itemCount: integer,
  sizeBytes: bigint,
}

// Restore operation audit log
tenantSnapshotRestoreJobs: {
  id: uuid,
  tenantId: uuid FK,
  snapshotId: uuid FK,
  requestedBy: uuid FK -> users.id,
  requestedAt: timestamp,
  completedAt: timestamp,
  status: text,                  // "pending", "in_progress", "completed", "failed"
  restoreScope: jsonb,           // ["foundations", "objectives"] or ["all"]
  restoreMode: text,             // "full_overwrite" or "selective_merge"
  resultSummary: jsonb,          // Items restored, conflicts resolved
  notes: text,                   // Reason for restore
}
```

#### Snapshot Strategy

- **Daily full snapshots** capturing all tenant-scoped data
- **Data captured:**
  - Foundations (mission, vision, values, annual goals)
  - Strategies and strategy values
  - Objectives, Key Results, Big Rocks
  - Check-in history
  - Teams and team memberships
  - Meetings and meeting items
  - AI/Grounding documents
  - Custom vocabulary settings
  
- **Why full vs incremental?** Full snapshots provide simpler, more reliable restores without the complexity of rebuilding from incremental chains.

#### Storage Approach

- **Object Storage:** Azure Blob or S3-compatible storage
- **Compression:** zstd compression before upload
- **Encryption:** AES-256 encryption at rest (customer-managed key support for enterprise)
- **Lifecycle Policies:** Auto-delete objects past retention window
- **Estimated Sizing:** (avg tenant data × retention days) for cost calculation

#### Scheduling Mechanism

```
Daily Snapshot Pipeline (runs 2:00 AM UTC):
├── Enumerate premium tenants with snapshot access
├── For each tenant:
│   ├── Begin read-only transaction
│   ├── Export all tenant-scoped tables
│   ├── Compress and encrypt payload
│   ├── Upload to object storage
│   ├── Record metadata in tenant_snapshots
│   └── Commit and log success/failure
└── Run cleanup for expired snapshots
```

- **Background Job Runner:** BullMQ or Agenda for job queue management
- **Isolation:** Each tenant snapshot runs in isolated transaction
- **Monitoring:** Health metrics and failure alerting

#### Recovery Workflow

**Steps:**
1. Admin selects tenant and target snapshot date
2. Preview mode shows what will change (dry-run comparison)
3. Choose restore scope:
   - Full restore (all data)
   - Selective restore (specific modules only)
4. Choose restore mode:
   - Full overwrite (replace existing data)
   - Selective merge (with conflict resolution)
5. Execute restore with progress tracking
6. Notify tenant admins upon completion
7. Log operation in audit trail

#### Service Plan Integration

| Plan | Snapshot Access | Retention | Storage Limit |
|------|----------------|-----------|---------------|
| Free | ❌ No | - | - |
| Standard | ✅ Yes | 30 days | 1 GB |
| Premium | ✅ Yes | 90 days | 10 GB |

- API validates `includesSnapshotService` before snapshot/restore operations
- Upgrade CTA shown to non-premium tenants

#### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/snapshots/:tenantId` | GET | List available snapshots |
| `/api/admin/snapshots/:tenantId` | POST | Trigger manual snapshot |
| `/api/admin/snapshots/:id` | GET | Get snapshot details |
| `/api/admin/snapshots/:id/download` | GET | Download snapshot (signed URL) |
| `/api/admin/snapshots/:id/restore` | POST | Request data restore |
| `/api/admin/snapshots/:id/restore/preview` | POST | Dry-run restore preview |
| `/api/admin/snapshots/jobs/:jobId` | GET | Check restore job status |

#### Admin UI Components

**New "Data Protection" tab in Tenant Admin:**

```
┌─────────────────────────────────────────────────────────────┐
│  Data Protection                                             │
│  ═══════════════════════════════════════════════════════   │
│                                                              │
│  📊 Storage Usage: 245 MB / 10 GB                           │
│  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░ 2.4%                  │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ Available Snapshots                [📸 Create Now]     │ │
│  ├────────────┬──────────┬────────┬───────────┬──────────┤ │
│  │ Date       │ Size     │ Status │ Expires   │ Actions  │ │
│  ├────────────┼──────────┼────────┼───────────┼──────────┤ │
│  │ 2026-01-07 │ 2.8 MB   │ ✅     │ 89 days   │ [↻] [⬇]  │ │
│  │ 2026-01-06 │ 2.7 MB   │ ✅     │ 88 days   │ [↻] [⬇]  │ │
│  │ 2026-01-05 │ 2.6 MB   │ ✅     │ 87 days   │ [↻] [⬇]  │ │
│  │ ...        │ ...      │ ...    │ ...       │ ...      │ │
│  └────────────┴──────────┴────────┴───────────┴──────────┘ │
│                                                              │
│  📜 Restore History                                         │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 2026-01-03 • Restored OKRs from 2026-01-01            │ │
│  │            • By chris.mcnulty@synozur.com             │ │
│  │            • Reason: Accidental deletion              │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Restore Wizard:**
1. Select snapshot date
2. Choose scope (checkboxes for each module)
3. Preview changes (diff view)
4. Confirm with mandatory reason field
5. Progress indicator during restore
6. Success confirmation with summary

#### Retention & Cleanup

- **Rolling Retention:** Automatic deletion past retention window
- **Nightly Cleanup Job:** Removes expired records and storage objects
- **Per-Tenant Quotas:** Alerts when approaching storage limits
- **Immutable Audit Log:** All operations logged for compliance

#### Security Considerations

- **Encryption at Rest:** All snapshot data encrypted before storage
- **Signed URLs:** Time-limited download links (15-minute expiry)
- **RBAC:** Platform admin or tenant's own admin only
- **Temp File Cleanup:** Sanitize local files after upload
- **Audit Trail:** Complete logging of all snapshot/restore operations

#### Implementation Phases

```
Phase 1: Foundation (Week 1-2)
├── Database schema + migrations
├── Service plan model + tenant association
├── Object storage integration (Azure Blob/S3)
└── Basic snapshot export logic

Phase 2: Automation (Week 2-3)
├── Background job runner setup
├── Daily snapshot scheduling
├── Retention/cleanup worker
└── Monitoring + alerting

Phase 3: Recovery (Week 3-4)
├── Restore logic + conflict handling
├── Preview/dry-run capability
├── Admin UI components
└── Notification system
```

---

### Support Ticket Finishing Pass

**Status:** Scoped — ready to build  
**Effort:** 1-2 weeks (excluding Planner sync, which is tracked separately below)  
**Priority:** Medium  
**Added:** April 8, 2026

**Note on scope:** A full comparison against Constellation's support system
(`chris-mcnulty/synozur-scdp`) has been completed (April 8, 2026). Week 1
items have been implemented. Week 2 items remain scoped and ready to build.
Aurora Visual System fully implemented — see "Aurora Visual System — Implemented"
section below.

#### What's shipped today
- Schema: `supportTickets` + `supportTicketReplies` (`shared/schema.ts` ~2163)
- API: `POST/GET/PATCH /api/support/tickets`, reply threads, help-chat stream (`server/routes-support.ts`)
- User UI: `client/src/pages/Support.tsx` (list / new / detail with replies)
- Admin UI: `client/src/components/admin/AdminSupportTab.tsx` (filters, status/priority dropdowns, internal notes)
- Email: SendGrid acknowledgement + admin notification on create
- Help chatbot escalation: pre-fills ticket form from conversation summary

#### Concrete gaps to close

1. **Staff assignment UI ✅ COMPLETE.**
   The `assignedTo` column surfaces in `AdminSupportTab.tsx` via an "Assign to"
   dropdown populated from `vega_admin` + `vega_consultant` users (fetched via
   `GET /api/support/staff`). Current assignee shown as avatar + name in the
   ticket list and detail sidebar.

2. **Per-ticket status history. ✅ COMPLETE.**
   `support_ticket_history` table (ticketId, userId, field, fromValue, toValue,
   createdAt) records every change to `status`, `priority`, `assignedTo`, and
   `category`. Single-ticket PATCH and bulk-update endpoint both write history
   rows. Admin detail view renders a "Status History" timeline card with actor
   name, timestamp, and human-readable change description (e.g.
   "Assigned: Unassigned → Chris McNulty").

3. **SLA / response-time timers.**
   Add three derived fields to the ticket list: time since creation, time
   since last staff reply, and time since last user reply. Colour-code at
   configurable thresholds (e.g. >24h no staff reply = red). No schema change
   — computed on the fly from `createdAt` and the latest non-internal reply.

4. **Reply notifications (bidirectional) ✅ COMPLETE.**
   `sendSupportTicketReplyNotification()` added to `server/email.ts` with
   `staff_to_user` and `user_to_staff` directions. Staff non-internal replies
   email the ticket author. User replies email the assigned staff member (or
   all admins if unassigned). Internal notes never trigger email. Failures
   don't block the write.

5. **"My assigned tickets" view for staff ✅ COMPLETE.**
   "My Assigned" stat card + filter preset in `AdminSupportTab.tsx` scopes to
   `assignedTo = currentUser.id`. Also added "Assigned To" dropdown filter
   to select any staff member. "Pending" compound status filter (open +
   in_progress) added as status option and stat card.

6. **Bulk close / bulk status change. ✅ COMPLETE.**
   Per-row checkboxes + "Select all on page" in the admin list. When any
   tickets are selected a bulk-actions bar appears with: Change Status select,
   Reassign To select (all staff + "Unassigned"), and a "Close selected"
   button. Backed by `POST /api/support/tickets/bulk`; writes history rows and
   fires notifications for each updated ticket.

7. **Resolution templates. ✅ COMPLETE.**
   `CANNED_RESPONSES` constant in `shared/schema.ts` defines five built-in
   quick-reply templates (Acknowledged, Investigating, Fix Deployed, Need More
   Info, Closing). "Quick reply templates" select in the admin reply composer
   inserts the chosen body into the textarea (appends if text is already
   present).

8. **Search across tickets. ✅ COMPLETE.**
   Search input with clear button at the top of the admin filters card. Wired
   into the query key so results refresh on type. Backend `searchAdminSupportTickets()`
   accepts a `q` param and runs ILIKE `%term%` across `subject`, `description`,
   and reply `message` bodies, combined with any active status / priority /
   category / assignedTo filters.

9. **Category-to-priority defaults ✅ COMPLETE.**
   When a user selects category "bug", priority defaults to "high"; question
   and feature_request default to "medium"; feedback defaults to "low".
   Manual priority override is preserved — changing category resets the
   auto-default unless the user has manually selected a priority.

10. **Help Chatbot ticket deflection metric.**
    Track how often the help chatbot answered vs. escalated to a ticket.
    Store a boolean `escalatedToTicket` on chatbot conversation logs (if we
    have them) or fall back to a simple counter. Expose on the System Admin
    AI Usage dashboard.

#### Recommended implementation order

```
Week 1 (high-value, low-risk): ✅ ALL COMPLETE
├── (1) Staff assignment dropdown in AdminSupportTab ✅
├── (4) Bidirectional reply email notifications ✅
├── (5) "My assigned tickets" preset filter ✅
└── (9) Category-to-priority defaults ✅

Week 2 (structural): ✅ MOSTLY COMPLETE
├── (2) supportTicketHistory table + detail-view timeline ✅
├── (3) SLA timer badges in admin list — still open
├── (6) Bulk status change + bulk reassign ✅
├── (7) Canned reply templates (CANNED_RESPONSES constant) ✅
└── (8) Admin full-text search (q= across subject + description + replies) ✅
```

---

### Aurora Visual System — Implemented

**Status:** ✅ Complete  
**Added:** April 8, 2026  
**Last updated:** May 2026 (theme readability pass)

**Summary:** Full Aurora Visual System ported from Constellation (the current
Oconee brand standard). Constellation replaces Orion as the authoritative
brand reference.

**Implemented components:**

1. **Aurora Background Component** (`client/src/components/aurora.tsx`):
   Animated gradient blob background with three blur-3xl blobs using
   primary purple (277) and accent magenta (328) HSL colors. Supports
   `intensity` prop (low/medium/high), `theme` override, and optional
   `particles` canvas (dark mode only, 70 animated dots).

2. **CSS Utility Suite** (in `client/src/index.css`):
   - `synozur-gradient` / `synozur-gradient-text` — brand gradient fills
   - `cosmic-text` — three-stop gradient text effect for headings
   - `glow-primary` / `primary-cta-glow` — box-shadow glow on hover/focus
   - `sidebar-active-item` / `sidebar-hover-item` — sidebar glow classes
   - `animate-blob` + `animation-delay-2000/4000` — 12s blob animation
   - `animate-fade-in-up` + `stagger-1..6` — entrance animations
   - `nebula-shimmer` — branded loading skeleton (replaces pulse)
   - `nebula-card` — animated rotating gradient border (dark mode only)
   - `sidebar-item-active-gradient` — 3px gradient left bar on active item
   - `page-header-gradient-bar` — gradient top border on module header

3. **Purple-tinted shadows**: Light mode uses `hsl(277 50% 30%)` at subtle
   opacity; dark mode uses `hsl(277 30% 2%)` at higher opacity. Replaces
   the previous zero-opacity (invisible) shadow tokens.

4. **Theme Readability Pass (May 2026)**: Follow-on fix addressing a contrast
   collapse where card surfaces were barely distinguishable from the page
   background in both modes (cards at 99% vs 100% white in light; 17% vs
   11% navy in dark — a 6% gap invisible to the eye).

   *Light mode adjustments:*
   - `--card`: 99% → 97% (cards now clearly visible as elevated panels)
   - `--card-border`: 92% → 86%
   - `--border`: 89% → 82%
   - `--input`: 75% → 72%
   - `--popover`: 94% → 97% (synced with card)

   *Dark mode adjustments — establishes a 5-stop elevation ladder:*
   | Token | Before | After | Role |
   |---|---|---|---|
   | `--sidebar` | 7% | 6% | Deepest surface |
   | `--background` | 11% | 10% | Page background |
   | `--muted` | 17% | 13% | Sunken / inset areas |
   | `--card` | 17% | 22% | Raised panels |
   | `--secondary` | 22% | 28% | Elevated elements |
   | `--border` | 22% | 28% | Visible dividers |
   | `--muted-foreground` | 62% | 70% | Secondary text |

**Integration points:**
- Login page: Aurora background with `intensity="high"` and particles
- Landing hero: Aurora background with `intensity="medium"` and particles
- Company OS Dashboard heading: `cosmic-text` gradient
- Executive Dashboard heading: `cosmic-text` gradient
- Landing AI Tools heading: `cosmic-text` gradient
- Landing CTA button: `primary-cta-glow` hover effect
- Module header (all authenticated pages): `page-header-gradient-bar`
- Sidebar active items: `sidebar-item-active-gradient`
- Skeleton loading component: `nebula-shimmer` (replaces pulse)

---

### Support Ticket Planner Sync

**Status:** Proposed  
**Effort:** 2-3 weeks  
**Priority:** Medium  
**Added:** February 16, 2026

Optionally sync Vega support tickets to a **common** Microsoft Planner plan that receives tickets from **all tenants**. This differs from per-tenant Big Rock Planner sync — support tickets from every tenant funnel into a single shared Planner plan managed by Vega admins. Per-tenant opt-in controls whether a tenant's tickets flow to Planner.

#### Design Decisions

1. **Common Planner Plan (not per-tenant):** All tenant support tickets sync to one shared Planner plan. This gives the Vega support team a unified view in Microsoft Teams/Planner across all customer tenants.
2. **Per-Tenant Opt-In:** Each tenant can enable/disable support ticket sync independently via Tenant Admin settings.
3. **Constellation-Style Plan Selection:** Uses the same multi-step wizard pattern (Team → Channel → Plan → Bucket) already built for Big Rocks.
4. **Help Chatbot Escalation:** Tickets created from the AI Help Chatbot already escalate to the support ticket system — they will automatically sync to Planner like any other ticket.

#### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  System Admin → Support Planner Configuration               │
│  ═══════════════════════════════════════════════════════     │
│                                                              │
│  Common Support Plan: [Select Planner Plan]                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Team: Vega Support Team                          │       │
│  │ Plan: Support Tickets                            │       │
│  │ Default Bucket: Incoming                         │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Bucket Mapping (optional):                                  │
│  ┌──────────────────────────────────────────────────┐       │
│  │ Bug         → "Bugs" bucket                      │       │
│  │ Feature Req → "Feature Requests" bucket          │       │
│  │ Question    → "Questions" bucket                 │       │
│  │ Feedback    → "Feedback" bucket                  │       │
│  └──────────────────────────────────────────────────┘       │
│                                                              │
│  Per-Tenant Opt-In:                                          │
│  ┌──────────────────────────────────────────────────┐       │
│  │ ☑ Acme Corp     ☑ Beta Inc     ☐ Gamma LLC      │       │
│  └──────────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

#### Database Schema Changes

**Key Design Decision:** The common support Planner plan is NOT stored in the existing tenant-scoped `plannerPlans`/`plannerBuckets`/`plannerTasks` tables. Those tables are designed for per-tenant Big Rock sync. Instead, we use a dedicated `support_planner_config` table that stores Graph IDs directly, bypassing the tenant-scoped planner data model entirely. The `graph-planner.ts` functions (like `getClient()`) can be reused for Graph API calls by passing the configured `azureTenantId`, but plan/bucket/task records are NOT duplicated into the existing tenant-scoped tables.

```typescript
// New: Platform-level support planner configuration (standalone, not tenant-scoped)
supportPlannerConfig: pgTable("support_planner_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  
  // Direct Graph IDs (NOT FK to plannerPlans — this is a global config, not tenant-scoped)
  graphPlanId: text("graph_plan_id"),             // Microsoft Graph plan ID
  graphBucketId: text("graph_bucket_id"),         // Default bucket Graph ID
  graphGroupId: text("graph_group_id"),           // M365 Group hosting the plan
  planTitle: text("plan_title"),                  // Display name of the plan
  
  // Azure tenant that hosts this Planner plan (for app-only auth via planner-auth.ts)
  azureTenantId: text("azure_tenant_id").notNull(),
  
  // Category-to-bucket mapping (optional)
  categoryBucketMapping: jsonb("category_bucket_mapping"),
  // e.g. { "bug": "graph-bucket-id-1", "feature_request": "graph-bucket-id-2", ... }
  // Values are Graph bucket IDs, not FK to plannerBuckets
  
  enabled: boolean("enabled").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Extend tenants table:
// Add: supportPlannerSyncEnabled boolean default false
// Controls whether this tenant's tickets flow to the common Planner plan

// Extend supportTickets table:
// Add: graphTaskId text          -- Microsoft Graph task ID (NOT FK to plannerTasks)
// Add: plannerSyncedAt timestamp
// Add: plannerSyncError text
```

**Graph API Reuse:** The `getPlannerGraphClient(azureTenantId)` function from `planner-auth.ts` works for any Azure tenant ID. For support ticket sync, we call it with `supportPlannerConfig.azureTenantId` to get a Graph client, then make direct Graph API calls (create task, update task) without going through the tenant-scoped storage methods in `graph-planner.ts`. A new `support-planner.ts` service module handles the support-specific sync logic.

#### Sync Logic

1. **On Ticket Creation (POST /api/support/tickets):**
   - Check if support Planner sync is globally enabled
   - Check if the ticket's tenant has opt-in enabled
   - If both true, create a Planner task in the common plan:
     - Title: `[TICKET-{number}] {subject}`
     - Bucket: Mapped by category (or default bucket)
     - Description: Ticket description + tenant name + author info
     - Priority: Map ticket priority → Planner priority (low=9, medium=5, high=1)
     - Labels: Tenant name, category
   - Store the `graphTaskId` on the support ticket record

2. **On Ticket Status Update (PATCH /api/support/tickets/:id):**
   - If ticket has a plannerTaskId, update the Planner task:
     - `open` → percentComplete: 0
     - `in_progress` → percentComplete: 50
     - `resolved` → percentComplete: 100
     - `closed` → percentComplete: 100

3. **On Planner Task Update (Sync Job / Optional):**
   - Periodically check Planner tasks for changes
   - If Planner task marked complete, update ticket status to "resolved"
   - If Planner task reassigned, optionally update ticket assignee

4. **Auth:** Uses existing multi-tenant app-only client_credentials auth from `planner-auth.ts`. The common Planner plan lives in a specific Azure tenant (configured in supportPlannerConfig.azureTenantId).

#### API Endpoints

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/support-planner/config` | GET | Get support Planner configuration |
| `/api/admin/support-planner/config` | PUT | Update configuration (plan, buckets, mapping) |
| `/api/admin/support-planner/tenants` | GET | List tenants with sync opt-in status |
| `/api/admin/support-planner/tenants/:id` | PATCH | Toggle tenant opt-in |
| `/api/admin/support-planner/sync` | POST | Manual sync (push pending tickets) |

#### UI Changes

1. **System Admin Panel → New "Support Planner" tab:**
   - Constellation-style wizard to select the common Planner plan (Team → Plan → Bucket)
   - Category-to-bucket mapping configuration
   - Per-tenant opt-in toggle list
   - Sync status and error display

2. **Tenant Admin Panel → Support Settings:**
   - Toggle: "Sync support tickets to Planner" (if globally enabled)
   - Read-only display of which Planner plan tickets sync to

3. **Admin Support Tab (ticket detail):**
   - Show Planner sync status badge on each ticket
   - Link to open the Planner task directly
   - Manual "Sync to Planner" button for tickets that failed sync

#### Implementation Phases

```
Phase 1: Schema & Configuration (Week 1)
├── Database schema additions (supportPlannerConfig, ticket fields)
├── System Admin configuration UI (plan selection wizard)
├── Per-tenant opt-in settings
└── API endpoints for config management

Phase 2: Ticket → Planner Sync (Week 1-2)
├── Auto-create Planner task on ticket creation
├── Status update sync (ticket status → Planner percentComplete)
├── Priority mapping
├── Category → bucket routing
└── Error handling and retry logic

Phase 3: Bidirectional Sync & Polish (Week 2-3)
├── Planner → ticket status sync (via scheduled job)
├── Sync status badges in admin ticket views
├── Direct Planner task links
├── Manual sync/retry for failed tickets
└── Testing and edge cases
```

#### Key Differences from Big Rock Planner Sync

| Aspect | Big Rock Sync | Support Ticket Sync |
|--------|--------------|---------------------|
| Scope | Per-tenant, per-Big Rock | Global common plan, all tenants |
| Plan Selection | Each Big Rock picks its own plan | Single plan configured by Vega Admin |
| Auth | Uses ticket's tenant azureTenantId | Uses a single configured azureTenantId |
| Bucket Mapping | User-selected per Big Rock | Auto-mapped by ticket category |
| Sync Direction | Bidirectional (tasks ↔ Big Rock tasks) | Primarily ticket → Planner, optional reverse |

---

### Strategy Cascade Visualization (Strategy Map)

**Effort:** 2-3 weeks  
**Priority:** Medium

Interactive visual map showing how annual goals flow down to strategies, objectives, key results, and big rocks.

**Key Capabilities:**
- Sankey diagram or tree visualization with color-coded status
- Visual detection of "orphan" items
- Drill-down filtering by team, quarter, or company values
- Exportable for presentations

---

### OKR Health Scoring & Predictive Analytics

**Effort:** 3-4 weeks  
**Priority:** Medium

AI-powered health scoring system with multi-factor scoring:
- Progress Trajectory (30%)
- Check-in Frequency (20%)
- Historical Performance (20%)
- Dependency Health (15%)
- Time Remaining (15%)

Predictive classifications: Likely to Achieve, Needs Attention, At Risk, Unlikely to Achieve

---

### Cross-Team Dependencies & Collaboration Hub

**Effort:** 2-3 weeks  
**Priority:** Medium-High

Formal system for declaring and tracking cross-team dependencies:
- Dependency types: blocking, contributing, informational
- Network graph visualization
- Request/accept workflow with discussion threads
- Auto-integration with Focus Rhythm meeting agendas

---

### Global Command Palette & Keyboard Shortcuts ✅ PARTIALLY COMPLETE (May 2026)

**Effort:** 1 week  
**Priority:** Medium

Power-user feature (⌘K / Ctrl+K) for fuzzy searching and quick actions:
- ✅ Search across all entities (objectives, key results, big rocks, meetings, people) — shipped as the new Global Search header bar in May 2026 — Version 1.11. Tenant-scoped, permission-aware, grouped by entity type.
- Navigate shortcuts (G then D for Dashboard, etc.) — still pending.
- Action commands (New Objective, Quick Check-in) — still pending.

Uses `cmdk` package (already installed).

---

### Personalized Dashboard Widgets & Pinned Items

**Effort:** 2 weeks  
**Priority:** Medium

Customizable dashboard with drag-and-drop widgets:
- Widget library (My OKRs, Team Health, At-Risk Items, etc.)
- Role-based default layouts
- Pinned items for quick access

---

### Progress Timeline & Activity Feed ✅ PARTIALLY COMPLETE (May 2026)

**Effort:** 1-2 weeks  
**Priority:** Medium

Visual progress trends and real-time activity feed:
- ✅ Daily progress snapshots now persist a full history per objective and key result (May 2026 — Version 1.11), unblocking interactive line charts and sparklines.
- Interactive line charts showing KR progress over time (data now available; UI surfaces still pending).
- Global activity feed with filters (still pending).
- Sparkline mini-charts on objective cards (still pending).

---

### Serial Check-In Step-Through (My Focus)

**Status:** Proposed  
**Effort:** 2–3 days  
**Priority:** Medium-High  
**Category:** UX / Engagement

#### What it is

A guided, step-through workflow that lets a user clear their entire backlog of stale check-ins in one focused session without navigating away from a single dialog. A "Start Check-Ins (N)" button on the My Focus page's **Overdue Check-ins** card assembles a prioritised queue of every objective, key result, and big rock the user owns that hasn't been checked in on within the last 7 days. The existing check-in dialog is then pre-loaded with the first item in the queue and gains Prev / Skip / Next / Record navigation controls. The user works through the queue item by item — recording a check-in, skipping an item entirely, or stepping back to revisit a previous one — and the dialog closes automatically when the last item is saved or skipped.

#### Why it matters

Today, My Focus shows the overdue check-in list but each item's arrow button just links to the general `/planning` page, leaving the user to hunt for and open each individual check-in dialog themselves. This makes catching up on 5–10 stale items an unnecessarily tedious, multi-click process. The serial step-through turns it into a single focused session: open once, work through everything, done.

Additional motivation:
- Big rocks are currently **absent** from the overdue check-ins list entirely — they must be added to the queue as a prerequisite.
- The new Big Rock check-in dialog already supports inline task status updates; those pending task edits should carry through correctly when "Record & Next" is pressed.
- Regular check-in cadence is one of the strongest predictors of OKR success; removing friction directly improves adoption.

---

#### Queue Building Logic

The queue is assembled once when the user clicks "Start Check-Ins" and is not rebuilt mid-session (so skipped items stay skipped even if the user refreshes).

**Included items (all three types):**
- Objectives the user owns (`ownerId`, `ownerEmail`, `coOwnerIds`, or `checkInOwnerId` matches) where status is not `completed` or `cancelled` and `lastCheckInAt` is `null` or ≥ 7 days ago.
- Key results the user owns (`ownerId` or `ownerEmail` matches) under the same conditions.
- Big rocks the user owns (`ownerId`, `ownerEmail`, or `accountableId` matches) where status is not `completed` or `cancelled` and `lastCheckInAt` is `null` or ≥ 7 days ago. *(Currently missing from My Focus — must be added.)*

**Sort order (most urgent first):**
1. `at_risk` pace items
2. `behind` pace items
3. `stalled` items (no check-in for ≥ 21 days regardless of pace — same threshold used by the `HierarchicalOKRTable` risk signal)
4. `no_data` items (never checked in, or newly created with no progress)
5. `on_track` / `ahead` items that are simply stale (≥ 7 days since last check-in but not stalled)

Within each urgency tier, items are sorted by days-since-last-check-in descending (stalest first). Items with `null` (never checked in) rank ahead of items with a known date within the same tier.

---

#### UX Specification

##### Entry Point

The "Start Check-Ins" button lives in the header row of the **Overdue Check-ins** card on My Focus, right-aligned next to the badge count. It is only rendered when the queue is non-empty.

```
┌─ Overdue Check-ins  [6]  ─────────────────────  [Start Check-Ins (6)] ─┐
│ ...existing overdue items list...                                         │
└──────────────────────────────────────────────────────────────────────────┘
```

##### Dialog Layout

The dialog reuses the existing check-in dialog in `PlanningEnhanced.tsx` with three additions: a counter in the header, a context line below the title, and Prev / Skip / Next / Record controls in the footer.

```
┌─ Check-in (2 of 6) ───────────────────────────────────────────────────────┐
│ Grow Annual Recurring Revenue                                               │
│ Key Result  ·  18 days ago  ·  At Risk  ·  34%  ████░░░░░░░░              │
│ ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  New Progress    [slider / value input]                                     │
│  Status          [on track ▾]                                               │
│  Note            [textarea]                                                 │
│                                                                             │
│ ─────────────────────────────────────────────────────────────────────────  │
│  [← Prev]   [Skip →]                      [Cancel]   [Record & Next →]    │
└────────────────────────────────────────────────────────────────────────────┘
```

On the **last item** in the queue, the primary button reads **"Record & Finish"** instead of "Record & Next", and pressing it saves the check-in and closes the dialog.

##### Button Behaviours

| Button | Action |
|---|---|
| **Record & Next** | Saves the current check-in (calls the same create/update mutation), invalidates relevant query cache, advances `currentIndex` by 1. If this was the last item, closes the dialog. |
| **Record & Finish** | Same as Record & Next but shown on the last item; closes dialog on success. |
| **Skip →** | Advances `currentIndex` without saving anything. If this was the last item, closes the dialog. |
| **← Prev** | Decrements `currentIndex` by 1 (does NOT undo a previously saved check-in). Disabled on the first item. |
| **Cancel** | Closes the dialog without saving. Any already-recorded check-ins in the session remain saved. |

##### Counter Display

The dialog title shows **"Check-in (X of Y)"** where Y is the **initial** queue length captured when "Start Check-Ins" was clicked. X is the 1-based current position. This gives the user a clear sense of how many items are left.

---

#### State Management

All queue state lives in `MyFocus.tsx`:

```
checkInQueue: CheckInQueueItem[]   // built once on "Start Check-Ins"
currentQueueIndex: number          // 0-based position in queue
isQueueOpen: boolean               // controls dialog visibility
```

`CheckInQueueItem` shape:
```typescript
{
  id: string;
  title: string;
  type: "objective" | "key_result" | "big_rock";
  daysSince: number | null;
  progress: number;
  status: string;
  paceStatus: PaceStatus;
}
```

The queue is passed down to the check-in dialog (or the dialog is mounted in `MyFocus.tsx` directly). When a check-in is recorded, `currentQueueIndex` increments. When the index reaches `checkInQueue.length`, the dialog is closed.

The existing `pendingTaskUpdates` pattern from the Big Rock check-in (in `PlanningEnhanced.tsx`) must be preserved: when the current item is a big rock and the user has changed task statuses in the inline task section, all pending task PATCHes fire in parallel before or alongside the main check-in mutation — same as the current behaviour when saving from the check-in dialog directly.

---

#### Cache Invalidation

After each "Record" action, invalidate:
- `['/api/okr/objectives', tenantId, quarter, year]` — if item type is `objective`
- `['/api/okr/key-results', tenantId, quarter, year]` — if item type is `key_result`
- `['/api/okr/big-rocks', tenantId, quarter, year]` — if item type is `big_rock`
- `['/api/okr/big-rocks', bigRockId, 'tasks']` — if big rock task updates were flushed

This causes the My Focus overdue count badge to decrement live as the user works through the queue, providing immediate positive feedback.

---

#### Implementation Plan

1. **Add big rocks to My Focus overdue list** — Extend `overdueCheckIns` memo in `MyFocus.tsx` to include big rocks owned by the user (same 7-day threshold). Add a `"big_rock"` discriminant to the item type union.

2. **Add queue state to MyFocus** — Add `checkInQueue`, `currentQueueIndex`, and `isQueueOpen` state. Add "Start Check-Ins (N)" button to the Overdue Check-ins card header.

3. **Extend check-in dialog for queue mode** — Add optional `queueMode` props to the check-in dialog section in `PlanningEnhanced.tsx` (or extract a shared dialog component): `totalInQueue`, `currentIndex`, `onSkip`, `onPrev`. Wire footer buttons accordingly. Render context line (type pill · days since · pace badge · progress bar) below the dialog title.

4. **Wire "Record" to advance queue** — Modify `createCheckInMutation.onSuccess` (and `updateCheckInMutation.onSuccess`) when in queue mode to increment `currentQueueIndex` instead of just closing the dialog. Fire cache invalidation for the just-recorded item type.

5. **Flush pending task updates per-item** — Ensure `pendingTaskUpdates` is reset to `{}` when navigating between queue items (Skip or Record), not only at the outer save point.

#### Relevant Files

- `client/src/pages/MyFocus.tsx` — queue state, "Start Check-Ins" button, big rocks inclusion
- `client/src/pages/PlanningEnhanced.tsx` — check-in dialog, mutation handlers, pending task updates logic

---

## BUSINESS SUCCESS OPTIMIZATION

> **The Big Idea:** Vega becomes not just a tool teams use, but the platform through which organizations become systematically great at execution. These proposals position Vega as the central nervous system for organizational performance - combining predictive AI, behavioral science, network analysis, continuous learning, and ecosystem integration to make goal achievement inevitable rather than aspirational.

**Date:** December 30, 2025 | **Version:** 1.0

---

### Implementation Roadmap

#### Phase 1: Foundation (Q1 2026) - Quick Wins

| Feature | Effort | Impact | Priority | Status |
|---------|--------|--------|----------|--------|
| OKR Quality Scoring | Medium | High | P1 | ✅ DONE |
| Automated Retrospectives | Medium | High | P1 | |
| Enhanced Dependency Risk | Low | Medium | P1 |
| Check-in Habit Features (streaks, nudges) | Low | Medium | P2 |
| Pattern Library v1 | Low | Medium | P2 |

#### Phase 2: Intelligence (Q2 2026) - Differentiation

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Probabilistic Outcome Forecasting | High | Very High | P1 |
| Collaboration Graph | Medium | High | P1 |
| Leading Indicator Detection | High | High | P2 |
| Meeting Intelligence | Medium | Medium | P2 |

#### Phase 3: Ecosystem (Q3 2026) - Platform Play

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| CRM Integration (Salesforce, HubSpot) | High | Very High | P1 |
| Product Tool Integration (Jira, Linear) | High | High | P1 |
| Strategic Command Center | Medium | High | P2 |
| Bi-directional Workflows | High | High | P2 |

#### Phase 4: Transformation (Q4 2026) - Market Leadership

| Feature | Effort | Impact | Priority |
|---------|--------|--------|----------|
| Virtual Strategy Consultant | Very High | Very High | P1 |
| Self-Service Transformation Journeys | High | High | P1 |
| Certification Platform | Medium | Medium | P2 |
| Cross-Organization Benchmarking | High | High | P2 |

---

### Success Metrics

#### Business Impact Metrics

| Metric | Current Baseline | Year 1 Target | Year 2 Target |
|--------|------------------|---------------|---------------|
| Customer OKR Achievement Rate | ~65% | 75% | 85% |
| Time to Value (first successful quarter) | 12 weeks | 8 weeks | 6 weeks |
| Check-in Consistency | 45% weekly | 70% weekly | 85% weekly |
| Strategic Alignment Score | Unknown | 70% | 85% |
| Customer Retention (Vega) | 85% | 92% | 95% |
| NPS (Vega) | Unknown | 45 | 60 |

#### Platform Metrics

| Metric | Target |
|--------|--------|
| Integrations Active per Customer | 3+ |
| AI Recommendations Acted On | 40%+ |
| Forecasting Accuracy | 80%+ |
| Consultant Time Savings | 50%+ |

---

### Pillar 1: Predictive Intelligence Engine

**Vision:** Transform Vega from a **rearview mirror** (tracking what happened) to a **windshield** (predicting what will happen and prescribing what to do).

#### 1.1 Probabilistic Outcome Forecasting

**Current State:** Vega shows progress percentages and status colors, but users must interpret what this means for achieving targets.

**Design Mock:**
```
┌─────────────────────────────────────────────────────────────┐
│  OBJECTIVE: Launch Enterprise Product by Q4                │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  🎯 Probability of Success: 67% (↓ from 72% last week)     │
│                                                             │
│  📊 Monte Carlo Simulation (1000 scenarios):               │
│     ├── 95% Confidence: Complete by Mar 15 - May 22        │
│     ├── Most Likely: Complete by Apr 3                     │
│     └── Current Target: Mar 31                             │
│                                                             │
│  ⚠️ Top Risk Factors:                                       │
│     1. KR3 velocity declining (impact: -12%)               │
│     2. Dependency on Platform Team blocked (impact: -8%)   │
│     3. Historical pattern: Q4 objectives 23% slower        │
│                                                             │
│  💡 AI Recommendations:                                     │
│     "Reallocate 20% capacity from KR1 (ahead of target)    │
│      to KR3. Similar rebalancing improved outcomes by      │
│      34% in analogous situations across 847 organizations."│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Key Capabilities:**
- **Monte Carlo simulations** using historical check-in velocity, seasonality, and dependency patterns
- **Bayesian probability updates** with each new check-in
- **Cross-organizational learning** (anonymized) to identify patterns like "objectives started in December have 18% lower success rates"
- **Prescriptive interventions** ranked by effort-to-impact ratio
- **What-if scenario modeling**: "If we add one more engineer, success probability increases to 82%"

**Business Impact:**
- Executives can allocate resources proactively, not reactively
- Teams course-correct weeks earlier, salvaging objectives that would have failed
- Organizations learn their own "execution metabolism" and set more realistic targets

#### 1.2 Leading Indicator Detection

**Concept:** Most OKR systems track lagging indicators (revenue, customers acquired). Vega should automatically identify and track leading indicators.

**How It Works:**
1. Analyze historical data to find correlations: "When customer meetings per week drop below 15, revenue objectives fail 80% of the time"
2. Surface these as **Early Warning Metrics** in the dashboard
3. AI generates suggested leading indicator KRs when users create objectives

**Example Output:**
```
"Based on your historical data, 'Website Traffic' is a strong leading 
indicator for 'Qualified Leads Generated'. Traffic typically leads 
conversion by 6-8 weeks. Current traffic trend suggests KR2 will 
be 15% below target. Consider adding a traffic-focused Big Rock."
```

#### 1.3 Organizational Stress Detection

**Concept:** Identify organizational stress before it manifests as missed objectives.

**Signals Monitored:**
- Check-in frequency declining (people avoiding bad news)
- Status updates becoming shorter (engagement dropping)
- Increasing use of "At Risk" without corresponding check-in notes (hiding problems)
- Time between status changes accelerating near quarter-end (panic mode)
- Cross-team dependencies stalling (collaboration breakdown)

**Design Mock:**
```
🏢 Organizational Health: 72/100 (declining)

⚠️ Signals Detected:
- Engineering team check-in frequency dropped 40% in 2 weeks
- 3 dependencies from Product → Engineering unacknowledged for 8+ days
- Executive sponsor hasn't viewed dashboard in 14 days

💡 Suggested Actions:
1. Schedule a "Blockers Amnesty" session with Engineering leadership
2. Escalate stalled dependencies to COO
3. Send automated progress summary to executive sponsors
```

---

### Pillar 2: Behavioral Science Integration

**Vision:** Apply behavioral economics and habit science to make high-performance behaviors **automatic and effortless** rather than requiring willpower.

#### 2.1 Habit-Forming Check-In System

**Current State:** Users must remember to check in. Many don't until reminded (or never).

**Proposed Enhancement: The "2-Minute Check-In" Habit Loop**

**Cue → Routine → Reward Design:**
1. **Smart Timing:** AI learns when each user is most likely to check in (after morning standup? Before weekly 1:1?) and sends contextual nudges
2. **Frictionless Entry:** Voice check-ins via Microsoft Teams bot: "Hey Vega, KR3 is now at 65%"
3. **Immediate Rewards:**
   - Streak counters with visual badges
   - Team leaderboards (opt-in) for check-in consistency
   - "Your updates helped your manager prep for the board in 5 minutes instead of 30"
4. **Variable Rewards:** Occasional "surprise" recognition when check-ins contain particularly useful insights

**Gamification Elements (Tasteful):**
- **Consistency Streaks:** "🔥 14-week check-in streak! You're in the top 5% of contributors"
- **Impact Visibility:** "Your Big Rock completion directly contributed to +$340K pipeline this month"
- **Team Challenges:** "Marketing vs. Sales: Which team hits 100% check-in rate first this quarter?"

#### 2.2 Commitment Devices

**Concept:** Help users pre-commit to outcomes using behavioral science.

**Features:**
- **Public Commitments:** Optional "I'm committed" badge that shows on objectives, creating social accountability
- **Implementation Intentions:** Prompt users to specify *when* and *where* they'll work on Big Rocks ("I will work on the pitch deck every Tuesday from 2-4pm")
- **Premortem Prompts:** When creating objectives, AI asks "Imagine it's end of quarter and you missed this. What went wrong?" This surfaces obstacles early.
- **Ulysses Contracts:** Users can opt to auto-schedule "no meeting" focus time when Big Rocks are at risk

#### 2.3 Friction Engineering

**Concept:** Add strategic friction to harmful behaviors, remove friction from beneficial ones.

**Add Friction To:**
- Changing status to "On Track" without a check-in note (requires explanation)
- Closing an objective without reviewing Key Results (completion ritual)
- Creating objectives without KRs (wizard requires at least 2 KRs)
- Setting unrealistic targets (AI warns based on historical patterns)

**Remove Friction From:**
- Check-ins (1-click, voice, bot)
- Viewing "my priorities" (persistent widget, morning email digest)
- Asking for help (Big Rocks can have "request support" button)
- Celebrating wins (auto-generated "achievements" from closed items)

#### 2.4 Social Proof Engine

**Concept:** Leverage social proof to drive adoption and best practices.

**Features:**
- "Organizations like yours typically have 3-5 org-level objectives per quarter"
- "Teams with weekly Focus Rhythm meetings achieve 34% more of their OKRs"
- "Top performers in your industry average 2.3 Big Rocks per KR"
- Anonymous benchmarking dashboards showing percentile performance

---

### Pillar 3: Organizational Network Intelligence

**Vision:** Map and optimize the **informal networks** through which work actually gets done, not just the formal hierarchy.

#### 3.1 Collaboration Graph

**Concept:** Build a real-time map of how people and teams actually collaborate.

**Data Sources:**
- Shared objective ownership and contributors
- Cross-team dependencies
- Meeting attendees (from Focus Rhythm)
- @mentions in check-in notes
- MS Teams/Slack interaction patterns (with consent)

**Design Mock:**
```
┌─────────────────────────────────────────────────────────────┐
│  COLLABORATION NETWORK - Q4 2025                           │
│                                                             │
│       ┌─────┐                                              │
│       │ Eng │◄────────────┐                                │
│       └──┬──┘             │                                │
│          │                │                                │
│          ▼          Strong collaboration                    │
│     ┌────────┐       ────────────                          │
│     │Product │◄─────►│  Design  │                          │
│     └────────┘       └──────────┘                          │
│          ▲                │                                │
│          │                ▼                                │
│     ┌────────┐       ┌──────────┐                          │
│     │ Sales  │       │Marketing │   Weak link (optimize!)  │
│     └────────┘ · · · └──────────┘   ·····················  │
│                                                             │
│  🔍 Insights:                                               │
│  - Sales ↔ Marketing collaboration 60% below benchmark     │
│  - Design is a hidden bottleneck (highest betweenness)     │
│  - Eng-Product sync optimal; maintain current practices    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**Business Value:**
- Identify silos before they cause failures
- Discover hidden influencers and bottlenecks
- Optimize team structures based on actual work patterns
- Predict integration challenges in reorgs

#### 3.2 Influence Mapping

**Concept:** Identify who actually drives outcomes, regardless of title.

**Metrics:**
- **Outcome Influence:** People whose involvement correlates with objective success
- **Network Centrality:** Who connects otherwise-siloed teams
- **Amplification Score:** Whose updates/decisions propagate fastest

**Use Cases:**
- Change management: Identify informal leaders to champion new initiatives
- Succession planning: Who has hidden institutional knowledge?
- Meeting optimization: Who actually needs to be in which meetings?

#### 3.3 Dependency Intelligence

**Current State:** Users manually declare dependencies.

**Proposed Enhancement:**

**Automatic Dependency Detection:**
- AI analyzes objective descriptions to suggest likely dependencies
- Pattern matching: "Every time a team creates 'API' objectives, they need Platform team support"
- Historical analysis: "These two teams' objectives have co-failed 4 of 5 quarters"

**Design Mock - Dependency Risk Scoring:**
```
DEPENDENCY RISK ASSESSMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Your Objective: Launch Mobile App v2.0
Dependencies: 3 identified

┌─────────────────────────────────────────────────────────────┐
│ 1. Platform Team: Auth Service v3         RISK: 🔴 HIGH    │
│    └─ Reason: Team at 120% capacity, 2 objectives behind   │
│    └─ Suggested Action: Escalate to CTO, consider plan B   │
├─────────────────────────────────────────────────────────────┤
│ 2. Design Team: Mobile UI Kit             RISK: 🟡 MEDIUM  │
│    └─ Reason: On track but historically late               │
│    └─ Suggested Action: Request early preview deliverables │
├─────────────────────────────────────────────────────────────┤
│ 3. Legal Team: App Store Compliance       RISK: 🟢 LOW     │
│    └─ Reason: Standard process, team has capacity          │
│    └─ Suggested Action: None needed                        │
└─────────────────────────────────────────────────────────────┘
```

#### 3.4 Meeting Intelligence

**Expand Focus Rhythm into Meeting Optimization:**

- **Meeting ROI Dashboard:** Time spent in meetings vs. OKR progress correlation
- **Attendee Optimization:** "Based on agenda, you may not need [Person X] in this meeting"
- **Meeting Type Analysis:** Which meeting cadences correlate with success?
- **AI-Generated Prep:** Before each meeting, AI summarizes relevant OKR changes
- **Post-Meeting Action Extraction:** AI parses notes and creates/updates Big Rocks

---

### Pillar 4: Adaptive Learning System

**Vision:** Build a **self-improving organization** where every quarter makes the next quarter more successful.

#### 4.1 Automated Retrospectives

**At Quarter-End, AI Generates:**

```markdown
# Q3 2025 Organizational Retrospective
Generated by Vega AI | December 1, 2025

## Executive Summary
This quarter, [Company] achieved 67% of objectives (vs. 58% Q2).
Key improvements in Engineering execution (+23%); opportunities
remain in cross-functional coordination.

## What Worked
1. **Weekly Big Rock reviews** (introduced Q3): Teams using this
   practice achieved 28% more objectives
2. **Reduced objective count**: From avg 8 to 5 per team correlated
   with +15% completion rate
3. **Early dependency declaration**: Teams declaring dependencies
   in week 1 had 40% fewer blockers

## What Didn't Work
1. **Mid-quarter pivots**: 4 objectives were significantly changed
   mid-quarter; 0 achieved target
2. **Individual OKRs**: 23% completion rate (vs. 71% for team OKRs)
3. **Annual objective tracking**: Rarely updated, unclear value

## Data-Driven Recommendations for Q4
1. Cap objectives at 5 per team (data shows diminishing returns)
2. Consider eliminating individual-level OKRs (high overhead, low value)
3. Require dependency mapping in first week of quarter
4. Avoid mid-quarter scope changes unless willing to accept lower targets

## Benchmarking (anonymized, 847 similar organizations)
- Your Q3 completion rate: 67% (74th percentile)
- Check-in frequency: 2.1/week (45th percentile - opportunity!)
- Big Rock effectiveness: 4.2 KR impact per rock (89th percentile)
```

#### 4.2 OKR Quality Scoring

**Real-Time Feedback During OKR Creation:**

```
┌─────────────────────────────────────────────────────────────┐
│  OKR QUALITY SCORE: 72/100                                 │
│  ═══════════════════════════════════════════════════════   │
│                                                             │
│  Objective: "Improve customer satisfaction"                 │
│                                                             │
│  ⚠️ Issues Found:                                           │
│  ├── Vague language (-10): What does "improve" mean?       │
│  ├── No timeframe (-8): When should this be achieved?      │
│  └── Missing context (-10): Which customers? Which aspect? │
│                                                             │
│  💡 AI Suggestion:                                          │
│  "Increase Enterprise customer NPS from 45 to 60 by        │
│   improving post-sales support response times"              │
│                                                             │
│  ✅ Strengths:                                              │
│  ├── Links to strategy (+10): Aligns with "Customer First" │
│  └── Reasonable scope (+10): Appropriate for team level    │
│                                                             │
│  [Apply AI Suggestion] [Edit Myself] [Skip Suggestions]    │
└─────────────────────────────────────────────────────────────┘
```

**Scoring Dimensions:**
- **Clarity:** Can anyone understand what success looks like?
- **Measurability:** Are Key Results truly quantifiable?
- **Achievability:** Based on historical data, is this realistic?
- **Alignment:** Does this ladder to higher-level objectives?
- **Time-Bound:** Is the timeline clear and appropriate?

#### 4.3 Pattern Library

**Curated best practices from successful organizations:**

- **OKR Templates:** "Here's how 23 high-growth SaaS companies structure their 'Market Expansion' objectives"
- **Big Rock Patterns:** "Most successful product launches include these 5 Big Rock categories"
- **Anti-Patterns:** "Objectives with more than 7 KRs succeed 42% less often"
- **Industry Benchmarks:** "Media companies typically achieve X% of objectives in Q4 (holiday impact)"

#### 4.4 Skill Gap Analysis

**Connect OKR outcomes to capability development:**

```
CAPABILITY ANALYSIS: Engineering Team

Based on Q1-Q3 2025 performance:

✅ Strengths (objectives in these areas achieve 80%+):
   - API Development
   - Infrastructure Scaling
   - Code Quality Initiatives

⚠️ Growth Areas (objectives achieve <50%):
   - Data Pipeline Projects (-23% vs. benchmark)
   - ML/AI Integration (-31% vs. benchmark)
   - Cross-Platform Development (-18% vs. benchmark)

💡 Recommendations:
   1. Consider training investment in Data Engineering
   2. Partner with external consultants for ML projects
   3. Hire 1-2 senior cross-platform specialists

📊 Training ROI Projection:
   If ML capability improves to benchmark:
   +2 additional objectives achievable per year
   Estimated business value: $800K-1.2M
```

---

### Pillar 5: Ecosystem Orchestration

**Vision:** Position Vega as the **strategic layer** that sits above all operational tools, providing unified visibility and orchestration.

#### 5.1 Universal Data Connectors

**Expand Beyond M365:**

| Category | Integrations | Value |
|----------|--------------|-------|
| **CRM** | Salesforce, HubSpot | Auto-populate revenue KRs from actual pipeline |
| **Product** | Jira, Linear, Asana | Big Rocks sync with epics/projects |
| **Analytics** | Mixpanel, Amplitude, GA4 | Real-time KR metrics from product data |
| **Finance** | QuickBooks, Xero, NetSuite | Financial KRs pull actual numbers |
| **HR** | Workday, BambooHR | Headcount, engagement data |
| **Engineering** | GitHub, GitLab | Deployment velocity, PR metrics |
| **Support** | Zendesk, Intercom | Customer satisfaction metrics |
| **Marketing** | HubSpot, Marketo | Pipeline, campaign metrics |

**Implementation Pattern:**
```
DATA SOURCE → Vega Metric → Key Result

Example:
Salesforce Closed-Won → KR: "$5M New ARR" → Auto-updates daily
GitHub Merged PRs → KR: "Ship 12 features" → Real-time progress
NPS Survey Tool → KR: "NPS > 50" → Updates after each survey
```

#### 5.2 Bi-Directional Action Orchestration

**Not just reading data—driving action:**

```
When KR "Reduce ticket resolution time to <4 hours" hits At Risk:
├── Auto-create Jira epic: "Support Optimization Sprint"
├── Slack notification to Support Lead
├── Add to next Monday's Focus Rhythm meeting agenda
└── Schedule AI-generated intervention meeting
```

**Workflow Automation Examples:**
- **OKR Created** → Auto-create Slack channel for objective
- **Big Rock Completed** → Trigger celebration message, update related KRs
- **Dependency Blocked** → Escalation workflow, notify stakeholders
- **Quarter Ends** → Generate reports, archive data, create next quarter structure

#### 5.3 Strategic Command Center

**Single pane of glass for executives:**

```
┌─────────────────────────────────────────────────────────────────────┐
│  STRATEGIC COMMAND CENTER - Live                                    │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  📊 COMPANY HEALTH                    🎯 QUARTERLY PULSE             │
│  ───────────────                      ─────────────────              │
│  Overall OKR Progress: 62%            Days Remaining: 34            │
│  Revenue vs Target: 94% ▲             At-Risk Items: 7 (↓2)         │
│  Customer NPS: 52 (▲4)                Blocked Dependencies: 3       │
│  Employee Engagement: 71%             Check-in Rate: 78%            │
│                                                                      │
│  🔥 NEEDS ATTENTION                   ✅ WINNING                     │
│  ─────────────────                    ────────                       │
│  • Platform Team at 140% capacity     • Mobile launch ahead 2 weeks │
│  • 3 unfilled critical roles          • Customer retention +12%     │
│  • Enterprise deal X stalled          • Engineering velocity +23%   │
│                                                                      │
│  📈 LIVE METRICS (from connected systems)                           │
│  ─────────────────────────────────────────                          │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░│ ARR: $12.4M of $15M target                │
│  │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░│ Pipeline: $8.2M of $10M target             │
│  │▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░│ MAU: 45K of 75K target                     │
│                                                                      │
│  [View Strategy Map] [Risk Dashboard] [Generate Board Report]       │
└─────────────────────────────────────────────────────────────────────┘
```

#### 5.4 AI Strategy Assistant

**Beyond Chat—Proactive Strategic Guidance:**

```
🤖 Vega Strategy Assistant
━━━━━━━━━━━━━━━━━━━━━━━━━

Good morning, Sarah. Here's your strategic briefing:

📊 OVERNIGHT CHANGES
• Pipeline deal "Enterprise Corp" moved to Closed-Won ($340K)
  → Revenue KR now at 94% (was 87%)
• GitHub: 3 major features merged
  → "Ship 12 features" KR now at 92% (was 75%)

⚠️ ATTENTION NEEDED
• Customer X escalated support ticket (NPS survey pending)
  → Risk to "NPS > 50" objective
  → Recommend: Proactive exec outreach before survey

💡 OPPORTUNITY DETECTED
• Your Q4 objectives are 89% aligned to Annual Goal #1
  but only 23% aligned to Annual Goal #3 (Market Expansion)
  → Consider adding objectives next quarter, or rebalance

📅 TODAY'S PRIORITIES (based on OKR impact)
1. Review stalled Platform dependency (blocks 2 objectives)
2. Approve Marketing budget (enables 3 Big Rocks)
3. 1:1 with Engineering Lead (2 at-risk items)

[Start Focus Mode] [View Full Dashboard] [Generate Report]
```

---

### Pillar 6: Consultant-as-a-Platform

**Vision:** Encode the expertise of the best OKR/strategy consultants into the platform, providing **enterprise-grade strategic consulting** at scale.

#### 6.1 Virtual Strategy Consultant

**AI-Powered Strategic Advisory:**

- **Annual Planning Facilitation:** AI guides executives through a structured annual planning process, asking the right questions, surfacing data, and documenting decisions
- **OKR Coaching:** Real-time guidance during OKR creation: "This objective seems tactical. Would you like to explore more strategic alternatives?"
- **Quarterly Review Facilitation:** AI-generated agendas, pre-populated with data and suggested discussion points
- **Best Practice Injection:** "Based on your industry and size, organizations typically set X objectives with Y KRs"

#### 6.2 Consultant Toolkit (for Human Consultants)

**Empower the Synozur Alliance consultants:**

- **Client Readiness Assessment:** Automated maturity scoring before engagement
- **Diagnostic Dashboard:** Instant view of client's strategic health
- **Intervention Playbooks:** Guided workflows for common challenges
- **Before/After Reporting:** Demonstrate impact of consulting engagements
- **Template Library:** Consultant-curated best-in-class examples

#### 6.3 Self-Service Strategic Transformation

**Guided journeys for organizations without consultants:**

```
VEGA TRANSFORMATION JOURNEYS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Choose your path:

🚀 First 90 Days with OKRs
   12-week guided implementation for OKR beginners
   ├── Week 1-2: Foundation setup (mission, vision, values)
   ├── Week 3-4: First OKR workshop (guided)
   ├── Week 5-8: First quarter execution with coaching
   └── Week 9-12: Review, learn, plan next quarter

📈 Scaling OKRs Company-Wide
   For organizations ready to expand beyond pilot teams
   ├── Alignment workshop template
   ├── Manager training modules
   ├── Rollout communication templates
   └── Success measurement framework

🔄 Turnaround: Fixing Broken OKRs
   For organizations struggling with OKR adoption
   ├── Diagnostic assessment
   ├── Common failure pattern identification
   ├── Reset playbook
   └── Sustained adoption program

💡 Advanced: OKRs + Culture Transformation
   Integrating OKRs with values and culture work
```

#### 6.4 Certification & Training Platform

**Build organizational capability:**

- **OKR Champion Certification:** Online course + assessment for internal OKR leaders
- **Executive OKR Briefing:** 30-minute interactive module for C-suite
- **Manager Coaching Modules:** How to coach teams on OKRs
- **Progress Tracking:** Which teams have certified champions?

---

### Competitive Differentiation

#### vs. Lattice/15Five/Culture Amp
These focus on performance management and engagement. Vega focuses on **strategic execution** with OKRs as the core, integrating with these tools rather than competing.

#### vs. Workboard/Perdoo/Gtmhub
These are OKR-focused but treat OKRs as a **tracking system**. Vega positions OKRs as part of a complete **Operating System** that includes AI-driven insights, behavioral science, and ecosystem orchestration.

#### vs. Asana/Monday/ClickUp
These are project/task management tools. Vega operates at the **strategy layer**, integrating with these tools to provide strategic context to tactical work.

#### Vega's Unique Position

```
                    STRATEGIC ────────────────────── TACTICAL
                         │
                         │   ┌─────────────────────┐
                         │   │       VEGA          │
                         │   │  Strategic Command  │
                         │   │  Center + AI        │
                         │   └─────────┬───────────┘
                         │             │
    HIGH ───────────────►│   ┌─────────▼───────────┐
    AI/INTELLIGENCE      │   │   OKR + Strategy    │
                         │   │   Engine            │
                         │   └─────────┬───────────┘
                         │             │
                         │   ┌─────────▼───────────┐
                         │   │  Ecosystem Layer    │
                         │   │  (Integrations)     │
    LOW ────────────────►│   └─────────────────────┘
                         │
```

---

### Next Steps

1. Prioritize proposals based on customer feedback and strategic fit
2. Create detailed technical specifications for Phase 1 items
3. Identify pilot customers for early access programs
4. Build POC for Probabilistic Forecasting (highest impact)
5. Begin integration partnerships (Salesforce, Jira)

> *"The best-run companies don't just set goals—they build systems that make achieving goals inevitable. Vega is that system."*

---

## KNOWN ISSUES & BUGS

### Production SSO Session Persistence Bug ✅ FIXED

**Status:** Resolved (December 2025)

Session cookie now persists correctly after Microsoft SSO redirect.

---

### Microsoft Planner Integration Issues

**Status:** Resolved (Priority 1 Complete)  
**Severity:** Low (remaining items are Priority 2/3)

Resolved Issues:
1. ~~Token dependency on Outlook connection~~ - Planner has independent OAuth flow with own service token store
2. ~~Scope limitations (read-only with Tasks.Read)~~ - Now uses Tasks.ReadWrite + Group.Read.All scopes
3. Rate limiting (100 req/10 sec) - Mitigated by 4-hour auto-sync cadence
4. ~~No automatic sync scheduler~~ - planner-sync job runs every 4 hours

Completed Features:
- PlannerTaskLinkPanel integrated into Objective and Big Rock detail views
- PlannerSyncStatusSection in TenantAdmin Integrations tab with metrics and manual sync
- Auto-sync scheduler job (planner-sync) running every 4 hours
- Token expiry detection with reconnect banners
- Independent OAuth flow (no Outlook dependency)

Remaining (Priority 2/3):
- Bidirectional sync (push Vega changes back to Planner)
- Big Rock to Planner Plan creation
- Real-time webhook notifications from Planner

---

### Microsoft SharePoint Integration Issues

**Status:** Partially Working  
**Severity:** Medium

Current Issues:
1. Sites.Selected permission limitations
2. URL resolution issues on certain formats
3. Drive discovery may miss some libraries

---

### TypeScript Circular Reference in Schema

**Status:** Known  
**Severity:** Low

Self-referencing types in `shared/schema.ts` cause implicit 'any' warnings. Does not affect runtime.

---

### Outcomes Page Black Screen with Excel Autosync

**Status:** Under Investigation  
**Severity:** Medium

Intermittent black screen on Outcomes page when Excel autosync is active. No error logs captured yet.

---

## TECHNICAL DECISIONS

### ADR-001: Session-Based Authentication

Use Express sessions with PostgreSQL storage instead of JWT tokens.
- Server-side session control
- Easy to invalidate sessions
- Works with existing PostgreSQL infrastructure

### ADR-002: Multi-Tenancy via tenantId

Implement multi-tenancy through `tenantId` foreign key on all scoped tables.
- Single database to manage
- Cross-tenant reporting possible
- Easy backup/recovery

### ADR-003: PostgreSQL with Drizzle ORM

Use PostgreSQL (Neon) with Drizzle ORM for type-safe database access.
- TypeScript-first ORM
- Excellent type inference
- Simple migrations with `npm run db:push`

### ADR-004: UUID Primary Keys

Use PostgreSQL `gen_random_uuid()` for all primary keys.
- Globally unique
- Non-sequential (security benefit)
- Easier data merging/imports

### ADR-005: TanStack Query for State Management

Use TanStack Query (React Query) for server state.
- Built-in caching and deduplication
- Automatic loading states
- Optimistic updates

### ADR-006: Shadcn/UI Component Library

Use shadcn/ui (Radix UI primitives) for consistent, accessible UI components.
- Full design control
- No version conflicts
- Highly customizable

### ADR-007: Pacific Time for All Date Operations

All date/time operations use America/Los_Angeles timezone.
- Prevents timezone misdating issues
- Consistent period detection for OKRs
- Used in `isPeriodEnded()` helper

---

## COMPLETED FEATURES

### May 2026 — Version 1.11 ✅

A milestone release focused on platform-scale performance, mobile reach, and the first external trust integration (Galaxy Portal).

**Performance**
- ✅ **Combined-Context Dashboard API** — single endpoint replaces 6+ per-render fan-out requests across Company OS, Executive, and Team dashboards
- ✅ **Recursive CTE Hierarchy Loader** — full objective tree + key results + big rocks load in a single query; multi-second large-tenant loads now resolve in milliseconds
- ✅ **Daily Progress Snapshots** — background job captures snapshots for every objective/key result, powering trend lines and forecast charts

**UX**
- ✅ **Mobile-Responsive OKR Tables** — hierarchical tables collapse into a card-stack layout with progressive disclosure on phones/tablets
- ✅ **Global Search** — header-level entity search across objectives, key results, big rocks, meetings, and people; tenant-scoped and permission-aware
- ✅ **In-App Notification Center** — header bell + dropdown + read/unread tracking for assignments, mentions, reminders, admin alerts
- ✅ **Check-in Draft Auto-Save & Drafts Management** — auto-saved tenant-scoped drafts with restore/discard, clear-on-submit, and conflict handling (rolled up from #33/#34/#35 follow-ups)

**Capabilities**
- ✅ **Live Meeting Mode** — facilitator agenda timer, quick-capture decisions/risks, attendee tracking, full state persistence across reload
- ✅ **Soft Delete & Trash Recovery** — soft-delete with 30-day automatic purge and admin-only Trash page for restore
- ✅ **Bulk Reassignment** — single-action transfer of all objectives/key results/big rocks from one owner to another
- ✅ **Objective Tree Depth-Cap Admin Alerts** (#29) — admin-tunable depth cap with warnings as the tree approaches or exceeds the threshold

**Integrations**
- ✅ **Galaxy Portal API & OAuth Trust** (#50/#51/#52/#53) — OAuth/JWT trust with Synozur's Galaxy customer portal, JIT-provisioned `portal_user` role, and a read-only `/api/portal/*` surface for OKRs, check-ins, and meetings

**Quality**
- ✅ **Depth-Cap & Cycle Detection Tests** (#30) — automated coverage for hierarchy depth enforcement, cycle detection, and warning emission

---

### Help Chatbot & Support Ticket System ✅ (February 8, 2026)

Two-part integrated help system with AI-powered Help Bot and Support Ticket management:

**Help Chatbot:**
- AI-powered help assistant grounded on USER_GUIDE.md content (truncated to 30k chars, cached on first load)
- Streaming responses via `/api/support/help/chat/stream` endpoint
- HelpChatPanel sliding panel component accessible from Help button in header toolbar
- Escalation: "Open Support Ticket" button pre-fills ticket form with conversation summary
- Session-based conversation memory (maintained in component state)

**Support Ticket System:**

**Database Schema:**
- `support_tickets` table: id (UUID), ticketNumber (serial), tenantId, userId, category, subject, description, priority, status, assignedTo, metadata (JSONB), timestamps
- `support_ticket_replies` table: id (UUID), ticketId, userId, message, isInternal (admin-only notes), createdAt

**Categories:** bug, feature_request, question, feedback
**Priorities:** low, medium, high
**Statuses:** open, in_progress, resolved, closed

**API Routes (server/routes-support.ts):**
- POST `/api/support/tickets` - Create ticket (authenticated users)
- GET `/api/support/tickets` - List tickets (own for users, all for admins with filters)
- GET `/api/support/tickets/:id` - Ticket detail with replies, author, tenant info
- POST `/api/support/tickets/:id/replies` - Add reply (owner or admin, internal notes for admin only)
- PATCH `/api/support/tickets/:id` - Update ticket status/priority/assignee (admin only)
- POST `/api/support/help/chat/stream` - AI help chatbot streaming endpoint

**Email Notifications (SendGrid):**
- User acknowledgment email on ticket creation with ticket details and tracking link
- Internal notification to all vega_admin users with full ticket context and admin link

**Frontend Components:**
- `HelpChatPanel` (`client/src/components/HelpChatPanel.tsx`) - Sliding panel from header toolbar
- `Support` page (`client/src/pages/Support.tsx`) - Ticket list, detail with reply thread, new ticket form
- `AdminSupportTab` (`client/src/components/admin/AdminSupportTab.tsx`) - Cross-tenant ticket management in System Admin → Support tab
- Admin features: filters (status/priority/category/tenant), status updates, internal notes, reply threads

**Navigation:**
- Help button in main header toolbar (opens HelpChatPanel)
- Support link in sidebar under support section (SPA navigation)
- Support tab in System Admin page (for vega_admin/vega_consultant)

---

### AI Documentation & Dashboard Update ✅ (February 7, 2026)

Comprehensive AI features documentation and Dashboard surfacing:

**User Guide Updates:**
- Added documentation for 10 AI features that were built but undocumented
- AI Check-in Note Rewriter (4 modes: full rewrite, clarity, concise, expand)
- AI OKR Suggestions, Big Rock Suggestions, Annual Goal Suggestions
- AI Strategy Drafter, Meeting Recap Parser, OKR Quality Scoring
- AI Progress Summary for reports
- Pace & Velocity Tracking with Pace Badges (Ahead, On Track, Behind, At Risk)
- AI Provider Configuration (System Admin → AI Config tab)
- Expanded Feature Overview with full AI & Intelligence category

**Dashboard Update:**
- Added "AI-Powered Tools" section to Company OS Dashboard
- Four feature cards: AI Chat, Pace & Velocity, AI Suggestions, Check-in Rewriter
- Surfaces AI capabilities to help users discover available tools

---

### What's New & Changelog ✅ (February 7, 2026)

AI-powered platform update notifications and full changelog access:

**What's New Modal:**
- Shown on login after new platform releases with AI-generated summary
- First-time users skip modal (see Launchpad welcome instead, lastDismissedChangelogVersion set silently)
- Dismissible per-version (stored in user record)
- Tenant admin toggle "Show Changelog on Login" in General settings → Notifications

**Changelog Page:**
- Full markdown-rendered changelog at `/changelog`
- Search, table of contents, scroll-to-top
- Accessible from sidebar navigation

---

### Ambitions Module ✅ (February 2, 2026)

Long-term strategic targets (3-5 years) bridging vision and annual goals:

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

### Annual Goals Move to Outcomes ✅ (February 7, 2026)

Annual Goals moved from Foundations to Outcomes module for tighter alignment with OKR planning workflows. All functionality preserved including AI suggestions, ambition linking, cloning, and year selectors.

---

### Performance Optimizations ✅ (February 7, 2026)

- Executive Dashboard batch key results fetch (eliminates N+1 queries)
- Storage batch methods: `getKeyResultsByObjectiveIds`, `getCheckInsByEntityIds`
- In-memory query cache with 60-second TTL and automatic invalidation on writes
- Report generation and COS export use batch queries

---

### MCP Server (Model Context Protocol) ✅ (January 17, 2026)

Secure MCP server for external AI assistant integration:

**Core Features:**
- 12 MCP tools: 9 read operations (get_okrs, get_big_rocks, get_strategies, get_mission, get_vision, get_values, get_annual_goals, get_teams, get_meetings) and 3 write operations (update_kr_progress, add_check_in_note, update_big_rock_status)
- Token exchange endpoint (`POST /mcp/token`) for API key → short-lived JWT conversion
- Main MCP server endpoint with streaming support
- Server info endpoint (`GET /mcp/info`) listing available tools and scopes

**Security Features:**
- API key authentication with bcrypt hashing
- Short-lived JWT tokens (1-hour expiry)
- 8 scope-based permissions (read:okrs, write:okrs, read:big_rocks, write:big_rocks, read:strategies, read:foundations, read:teams, read:meetings)
- IP allowlisting with CIDR notation support
- Key rotation with configurable grace periods
- Rate limiting (60 req/min per tenant, 10 token exchanges/min per IP)
- Admin-only access for all key management operations

**Admin UI:**
- Key management (create, view, revoke) in Tenant Admin → Integrations
- IP restrictions editing dialog
- Key rotation dialog with grace period selection
- Status badges (Active, Rotating, Expired)

**Audit & Logging:**
- Full audit logging for all MCP tool invocations
- Usage tracking per API key

---

### Enhanced Reporting System ✅ (January 11, 2026)

Complete reporting system with PDF and PowerPoint exports:

**Report Types & Dynamic Date Selection:**
- **Weekly Status**: Select from last 12 weeks with week picker
- **Monthly Report**: Month and year picker
- **Quarterly Business Review**: Quarter and year selection
- **Annual Review**: Year picker
- Correct date windows applied (7 days for weekly, 30 days for monthly, 90 days for quarterly, 365 days for annual)

**AI Period Summary (GPT-5 Powered):**
- Executive headline summarizing period performance
- Key themes (max 4) extracted from check-ins and progress
- Strategic guidance and recommendations
- Included as branded slide in PPTX exports

**PowerPoint (PPTX) Export Features:**
- **Executive Scorecard**: KPI cards, status donut chart, progress by level bar chart
- **Team Performance**: Bar chart comparing team progress, top/bottom performer highlights
- **Objectives Overview**: Detailed table with owners and status
- **Key Results Progress**: Bar chart with current vs target values
- **At-Risk Items**: Dedicated slide for items below 40% progress
- **Big Rocks Kanban**: Status-grouped columns with donut chart summary
- **Period Comparison**: Side-by-side snapshot vs current with delta callouts
- **Check-in Highlights**: Recent check-in notes with context
- **AI Period Summary**: AI-generated insights with branded styling (purple theme, rounded cards)
- **Configurable Slides**: Users can select which slides to include via checkboxes in a dialog

---

### AI Check-in Note Rewriter ✅ (January 2026)

AI-powered check-in note improvement with multiple rewrite modes:
- Full rewrite with professional tone
- Improve clarity (grammar/structure)
- Make concise (shorten while preserving key points)
- Add context (expand with metrics/status)

Integrated in OKRDetailPane check-in dialog and Team Dashboard.

---

### OKR Period Close-Out ✅ (December 31, 2025)

When checking in on objectives/KRs from a past period:
- Prompts user to continue in new period (opens clone dialog) or close
- Mandatory closing note when closing
- Uses Pacific Time for period detection
- Period-ended uses amber styling, target-exceeded uses green
- Closing notes persisted to database

### OKR Cloning ✅ (December 20, 2025)

Clone objectives with various scope options:
- Clone only objective, immediate children, or full hierarchy
- Target quarter/year selection
- Keep or reassign owner
- Progress reset to 0%

### Launchpad ✅ (December 20, 2025)

AI-powered document analysis for extracting and creating foundational company elements from uploaded strategic documents.

### Team Management ✅ (December 20, 2025)

Full CRUD UI in Tenant Admin:
- Team table with name, description, leader, member count
- Create/edit/delete teams
- Member management

### AI Usage Reporting ✅ (December 17, 2025)

Full implementation with Tenant + Platform admin UI for tracking AI provider/model usage and costs.

### Customizable Branding ✅ (December 2025)

White-label deployments:
- Logo URLs (primary, dark mode, favicon)
- Color scheme customization
- Report branding
- Dark mode logo support in sidebar

### Export/Import System ✅ (December 2025)

Export and import complete Company OS data:
- `.cos` JSON file format
- Duplicate handling strategies
- ID remapping for cross-tenant imports

### Custom Vocabulary ✅ (December 2025)

VocabularyContext with system-level defaults and tenant-level overrides for customizing terminology (Objective → Outcome, Key Result → Metric, etc.).

### Organized Navigation ✅ (December 30, 2025)

Collapsible sidebar sections organized by purpose (Execute, Plan & Align, Review & Learn, Manage, Platform, Personal).

---

### Job Scheduler Dashboard ✅ (January 31, 2026)

Platform-wide job monitoring and management for background tasks:

**Database Schema:**
- `scheduled_jobs` table: id, name, displayName, description, schedule, category, status, tenantId, lastRunAt, nextRunAt, createdAt
- `job_runs` table: id, jobId, status, trigger, summary, details, error, stackTrace, startedAt, completedAt

**JobScheduler Service:**
- Central service for registering, scheduling, and executing background jobs
- Supports multiple job categories: notification, sync, maintenance, system
- Automatic interval-based execution with configurable schedules
- Pause/resume functionality with persistent state
- Failure notification emails to all vega_admin users via SendGrid

**System Jobs Registered:**
- `expiration-reminders`: Daily check for expiring items and email notifications
- `reminder-cache-reset`: Daily cache maintenance

**Admin UI (System Admin → Scheduled Jobs):**
- Jobs List tab: View all registered jobs with status, schedule, category, last/next run times
- Run History tab: View execution history with status indicators (success/failed/running)
- Job controls: Run Now, Pause, Resume buttons (vega_admin only)
- Kill stuck runs with confirmation dialog and audit trail (killedByUserId, killedAt) (v1.8)
- Schedule editing with presets from every minute to daily intervals (vega_admin only) (v1.8)
- Tenant Admin users have view-only access

**API Routes:**
- GET `/api/jobs` - List all scheduled jobs
- GET `/api/jobs/runs/recent` - Get recent job runs
- POST `/api/jobs/:jobId/run` - Manually trigger job (vega_admin only)
- POST `/api/jobs/:jobId/pause` - Pause job (vega_admin only)
- POST `/api/jobs/:jobId/resume` - Resume job (vega_admin only)
- PATCH `/api/jobs/:jobId/schedule` - Edit job schedule (vega_admin only) (v1.8)
- POST `/api/jobs/runs/:runId/kill` - Kill stuck run (vega_admin only) (v1.8)

---

## IMPLEMENTATION NOTES

### Quick Wins Available

1. **Unified Time Period Selector** - Foundational UX improvement, medium effort
2. **Contextual Breadcrumbs** - High value for navigation clarity
3. **Command Palette** - Uses already-installed `cmdk` package

### Schema Changes Required

For future features requiring database changes:
- Dependencies table (for cross-team dependencies)
- Health scores table (for predictive analytics)
- User dashboard layouts table (for personalized widgets)

### Dependencies

- `@xyflow/react` - For mind map/strategy visualization
- `cmdk` - Already installed for command palette
- `recharts` - Already installed for progress charts

### Future - Only If Needed

- `pgvector` - Semantic search extension. **Not recommended** for Vega's structured OKR data. PostgreSQL full-text search is sufficient for keyword search. Only consider if document corpus exceeds 10,000+ unstructured files.

---

## Technical Debt

- **Remove ProgressDashboard component and related dead code from PlanningEnhanced.tsx** — The `ProgressDashboard` function component (currently at the bottom of `client/src/pages/PlanningEnhanced.tsx`) and its corresponding `TabsTrigger`/`TabsContent` entries have been commented out (hidden from users). The component code, including helper functions (`getProgressColor`, `getStatusIcon`, sorted objectives logic), should be fully deleted once confirmed no longer needed.

---

**For questions about this backlog, consult replit.md for project architecture context.**
