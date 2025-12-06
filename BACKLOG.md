# Vega Platform Backlog

**Last Updated:** December 5, 2025

---

## HIGH PRIORITY (Business-Critical)

### 1. RBAC Enforcement ⚠️ SECURITY GAP

**Status:** Not Started  
**Priority:** Critical  
**Effort:** 2-3 weeks

**Description:**
Role-Based Access Control is defined but not enforced. All authenticated users currently have full access regardless of their assigned role.

**Current State:**
- 6 roles defined: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`
- Roles assigned to users in database
- NO enforcement on API endpoints or UI

**Requirements:**
- Implement middleware to check user roles on protected routes
- Enforce tenant isolation (users can only access their tenant's data)
- Role-specific UI restrictions (hide features based on permissions)
- Permission matrix documentation

**Future Considerations:**
- **Team Membership (TBD):** Teams may optionally have limited membership, restricting which users can view/edit team-level objectives. This decision is pending and may affect how team-based access control is implemented.

**Business Value:** Essential for production deployment, compliance, and security.

**Dependencies:** None

---

### 2. Microsoft 365 Multi-Tenant Integration ⭐ UPDATED

**Status:** Not Started  
**Priority:** High  
**Effort:** 8-12 weeks (3 phases)

**Description:**
Enterprise-grade Microsoft 365 integration using multi-tenant OAuth with single-click admin consent. Synozur registers ONE app in Azure AD configured as multi-tenant. Customer admins click "Connect to Microsoft 365" → review permissions → accept. Done. No Azure AD portal access, no keys, no certificates required from customers.

---

#### Microsoft Graph Permission Scope (Refined)

| Service | Access Level | Permission | Vega Use Cases |
|---------|--------------|------------|----------------|
| **Outlook Calendar** | Read/Write | `Calendars.ReadWrite` | Meeting sync, Focus Rhythm scheduling |
| **Outlook Mail** | Write only | `Mail.Send` | Send meeting summaries, OKR alerts (no inbox reading) |
| **SharePoint** | Read only | `Sites.Read.All` | Pull strategy docs, governance files, shared resources |
| **OneDrive** | Read only | `Files.Read.All` | Import Excel files, attachments |
| **Microsoft Lists** | Read only | `Sites.Read.All` (same) | Mirror data into Vega, no write-back |
| **Planner** | Read only | `Tasks.Read` | View initiative status, no task creation |
| **Excel** | Read only | `Files.Read.All` (same) | Viva Goals import, workbook reads |

**Design Principle:** Read-only access wherever possible to minimize consent scope and security risk. Vega is the system of record; M365 provides context and inputs.

---

#### Phase 1: SSO Foundation (4-6 weeks)
- Multi-tenant app registration in Synozur Entra tenant
- `/api/auth/microsoft` callback route implementation
- Auto-provision trial tenants for new domains
- Add `authProvider`, `entraObjectId`, `entraRefreshToken` fields to user schema
- "Sign in with Microsoft" button in login UI
- Dual authentication support (email/password + SSO)

#### Phase 2: Graph API Integration (6-8 weeks)
- Admin consent endpoint (`/common/adminconsent`) integration
- Delegated permissions flow with MSAL
- Encrypted token storage system (AES-256) per tenant
- Graph API client service with tenant isolation
- "Connect Microsoft 365" UI in Tenant Admin settings
- Connection status display and disconnect option
- OKR import from Excel files (read-only)
- Planner status sync for Big Rocks (read-only)
- SharePoint document library browsing (read-only)

#### Phase 3: Enterprise Features (4 weeks)
- Custom app registration support for high-security tenants
- Tenant-specific app registration storage (optional override)
- Incremental consent for optional features (Mail.Send)
- Enterprise onboarding documentation

---

**Business Value:**
- Single-click consent for customer admins (no Azure AD expertise needed)
- Reduces friction for Microsoft 365 customers (90%+ of enterprise market)
- Enables seamless Excel/Planner/SharePoint data sync
- Read-only access minimizes security concerns and approval friction
- Enterprise-ready authentication
- Supports self-service and enterprise deployment models

**Technical Notes:**
- See `TECHNICAL_DECISIONS.md` for full architecture (ADR pending)
- Requires encrypted refresh token storage (AES-256)
- Multi-tenant app works for any Microsoft user globally
- No customer setup required for basic SSO
- Admin consent required for SharePoint, Lists, Planner scopes
- Throttling limits: Planner most restrictive (100 req/10 sec)

**Dependencies:**
- Environment variables: `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET`, `TOKEN_ENCRYPTION_KEY`
- Schema changes to `users` and `tenants` tables
- MSAL library for OAuth handling

---

### 3. Focus Rhythm Integration ⭐ NEW

**Status:** Not Started  
**Priority:** High  
**Effort:** 4-6 weeks

**Description:**
Connect weekly/monthly/quarterly/annual meetings to live OKR tracking, creating a continuous improvement loop.

**Features:**
- Meeting templates for different cadences (weekly standup, monthly review, quarterly planning, annual strategy)
- Link meetings to specific objectives, key results, and big rocks
- Log decisions, risks, and assignments per meeting
- Meeting minutes with action items
- Automatic agenda generation based on OKR status
- Meeting history and searchable archives

**Business Value:**
- Closes the execution gap between planning and doing
- Ensures strategic alignment in regular operations
- Creates audit trail for decision-making
- Drives accountability through tracked commitments

**Dependencies:**
- Existing `meetings` table in schema (already present)
- May integrate with Outlook Calendar (Phase 2 of Entra integration)

---

### 4. Culture & Values Integration ✅ COMPLETE

**Status:** Complete  
**Priority:** High  
**Effort:** 3 weeks  
**Completed:** December 2025

**Description:**
Tag objectives and strategies with company values to ensure values-driven decision making.

**Completed Features:**
- ✅ Values with title + description in Foundations module
- ✅ ValueTagSelector component for tagging entities
- ✅ Value tagging for Objectives (NOT Big Rocks - removed as data clutter)
- ✅ Value tagging for Strategies (NOT Big Rocks - removed as data clutter)
- ✅ Display value badges in Objective and Strategy detail views
- ✅ Backend APIs for value tag sync (add, remove, get)
- ✅ Values analytics endpoint (`/api/values/analytics/distribution`) with quarter/year filtering
- ✅ Value badges displayed in dashboard strategic priorities section
- ✅ Culture statement integration in dashboard (collapsible identity section)
- ✅ Values Alignment Dashboard Widget with:
  - Level breakdown (organization, team, division, individual) with counts and percentages
  - Time period filtering (quarter/year) 
  - Accurate progress bars reflecting actual distribution
  - Drill-down to see which objectives have each value
  - Summary stats (most/least represented values)

**Business Value:**
- ✅ Reinforces company culture in daily work
- ✅ Provides values-based reporting for leadership via analytics
- ✅ Helps teams make decisions aligned with culture
- ✅ Visual insights into which values drive the most work

**Future Enhancements (moved to MEDIUM priority):**
- Brand voice templates for AI-generated content
- Advanced values-based decision tracking
- Values trend analysis over time

**Dependencies:** None

---

### 5. AI-Powered Assistance ⭐ EXPANDED

**Status:** Not Started  
**Priority:** High  
**Effort:** 8-12 weeks

**Description:**
Chat-based AI assistant with culture-grounded outputs and MCP-style agent architecture.

**Features:**

**Phase 1: Basic AI Chat Enhancements (4 weeks)** ❌ No Vector DB Required
- Q&A interface for OKR queries ("What are our Q4 objectives?") - Uses function calling to query existing database
- Natural language reporting ("Show me all at-risk initiatives") - Direct SQL queries via AI tool use
- Context-aware responses (tenant-specific, user role aware) - Add role to existing AI context

**Phase 2: Culture-Grounded Intelligence (4 weeks)** ❌ No Vector DB Required
- Train on organization's values, mission, vision - Already implemented via grounding documents
- Suggest objectives aligned with strategic priorities - Direct entity queries + GPT analysis
- Draft key results based on historical patterns - Query check-in history directly
- Generate meeting agendas incorporating company culture - Uses existing Focus Rhythm data
- **AI Big Rock Generator** ✅ COMPLETE: Suggest missing Big Rocks based on analysis of objectives, key results, strategies, and goals. Identifies execution gaps where strategic priorities lack corresponding initiatives. *Implementation: analyzeStrategicGaps tool queries all entities, identifies strategies/objectives without Big Rocks, returns gap analysis for AI narration.*
- **AI OKR Ingestion** ⭐: Parse objectives and key results from uploaded documents (PDF, Word, Excel) or text pasted into the AI chat. Extract structured OKR data and create draft objectives with suggested key results for user review and approval. *Implementation: Uses existing file parsing + GPT extraction.*
- **AI Objective Gap Analyzer** ✅ COMPLETE: Identify annual goals and strategic priorities that lack corresponding objectives or have minimal activity. Suggest new objectives based on organizational context. *Implementation: analyzeObjectiveGaps tool cross-references goals→strategies→objectives linkages, returns coverage analysis.*
- **AI Foundation Element Suggestions** ✅ COMPLETE: Suggest extensions or alternatives to foundation elements (mission, vision, values, goals) based on organizational descriptive information and tenant context. *Implementation: getFoundationContext tool provides mission, vision, values, goals, strategies context for AI analysis.*

**Phase 3: Advanced Agent Features (4 weeks)** ✅ Vector DB Recommended
- Human-in-the-loop controls (approve before taking action) - MCP-style tool calling with confirmation UI
- Meeting prep automation (pull relevant OKRs, past decisions) - **Vector DB enables semantic retrieval of relevant historical data**
- Follow-up reminders and suggestions - Background analysis job
- Predictive analytics (risk detection, variance alerts) - Statistical analysis on check-in history
- **AI-Powered Semantic Search** ⭐: Natural language search across all Company OS data - **Requires vector embeddings**

**Business Value:**
- Reduces time spent on status reporting by 70%
- Improves strategic alignment through AI-powered suggestions
- Scales consultant expertise through AI
- Differentiator in market (culture-aware AI)

**Technical Notes:**
- OpenAI integration already available via Replit connector
- Phase 1 & 2: No vector database required - uses function calling and direct queries
- Phase 3: Vector database recommended for semantic search and efficient RAG
- Consider MCP (Model Context Protocol) for tool use in Phase 3

**Dependencies:**
- OpenAI API key (available ✅)
- Function calling / tool use (available via OpenAI ✅)
- Vector database - Phase 3 only (see Vector Database section below)

---

#### Vector Database Details (Phase 3 Prerequisite)

**What:** A vector database stores embeddings (numerical representations of text) enabling semantic similarity search.

**Why Needed for Phase 3:**
- **AI-Powered Search**: "Find objectives about growth" returns revenue, expansion, market share objectives
- **Efficient RAG**: Retrieve only the 5 most relevant grounding docs per query (vs. sending all)
- **Similar OKR Detection**: "This objective is 85% similar to one from Q2"
- **Meeting Prep**: Intelligently retrieve only relevant past decisions

**Recommended Option: PostgreSQL pgvector**
- Uses existing Neon database (no new infrastructure)
- Free with current database
- Sufficient for Vega's scale (thousands of documents)
- Can migrate to dedicated vector DB (Pinecone) later if needed

**Implementation Effort:** ~2 days
- Enable pgvector extension (5 min)
- Add embedding columns to schema (1 hour)
- Create embedding generation service using OpenAI `text-embedding-3-small` (2-3 hours)
- Build semantic search API (3-4 hours)
- Integrate with AI chat for RAG (4-6 hours)

**What Gets Embedded:**
1. Grounding Documents - Methodology, terminology, best practices
2. Objectives & Key Results - For semantic search and similarity detection
3. Strategies & Goals - For alignment analysis
4. Meeting Notes - For historical context retrieval
5. Check-in Notes - For pattern detection

**Cost:** ~$0.0001 per embedding via OpenAI, so 10,000 items ≈ $1

---

### 6. Enhanced Reporting & Snapshots

**Status:** Not Started  
**Priority:** High  
**Effort:** 4-6 weeks

**Description:**
Point-in-time snapshots for audit trails and branded report generation.

**Features:**

**Snapshot System:**
- As-of date snapshots for Objectives, Key Results, Big Rocks
- Snapshot metadata (created date, quarter, year, creator)
- Read-only historical views
- Comparison views (Q3 vs Q4, YoY)

**Report Generation:**
- Weekly status reports (automated)
- Quarterly business reviews (QBRs)
- Annual strategic reports
- PDF export with company branding
- PowerPoint export for board meetings
- Custom report templates

**Business Value:**
- Audit trail for compliance and governance
- Professional client deliverables for consultants
- Historical trend analysis
- Board-ready materials

**Dependencies:**
- Report generation library (e.g., PDFKit, Puppeteer)
- Template engine (Handlebars, EJS)

---

## MEDIUM PRIORITY

### 7. Company OS Export/Import System

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 2-3 weeks

**Description:**
Export and import complete Company OS data for portability, backups, and migrations.

**Features:**
- Export to `.cos` JSON file format
- Tenant-specific and year-specific filtering
- Import to different tenant or server
- Data validation and conflict resolution
- Dry-run import mode (preview changes)

**Use Cases:**
- Data portability between environments
- Backup and disaster recovery
- Testing with production data
- Consultant templates (pre-built Company OS structures)

**Business Value:**
- De-risks platform adoption (no lock-in)
- Enables consultant playbooks
- Supports migration workflows

---

### 8. Customizable Branding ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3-4 weeks

**Description:**
White-label deployments for enterprise customers and consultants.

**Features:**
- Custom logo upload per tenant
- Color scheme customization (primary, secondary, accent)
- Custom domain support (customer.vega.synozur.com)
- Branded email templates
- Custom terminology (rename "Big Rocks" to "Initiatives", etc.)

**Business Value:**
- Enables consultant resale model
- Enterprise sales advantage
- Higher perceived value

**Dependencies:**
- File upload for logos (already supported via tenant.logoUrl)
- CSS variable system (already in place)

---

### 8a. Custom Vocabulary (Viva Goals-style) ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3-5 days

**Description:**
Allow tenant admins to customize terminology using pre-defined dropdown options so that the words used make sense to everyone in their organizations. This matches Viva Goals' vocabulary customization feature.

**Customizable Terms:**

| Default Term | Available Options |
|--------------|-------------------|
| **Objective** | Objective, Outcome, Theme |
| **Key Result** | Key Result, Metric, Measure, Result |
| **Big Rock** | Big Rock, Project, To Do, Deliverable, Milestone, Initiative, Action |

**Implementation:**
- Add `vocabulary` JSONB field to `tenants` table storing term mappings
- Create Vocabulary Settings UI in Tenant Admin section
- Dropdown selectors for each customizable term
- Preview showing how terms will appear throughout the app
- Create `useVocabulary()` hook to retrieve tenant-specific terms
- Replace hardcoded terms throughout UI with vocabulary-aware components

**Example Schema:**
```typescript
vocabulary: {
  objective: 'Outcome',      // default: 'Objective'
  keyResult: 'Metric',       // default: 'Key Result'
  bigRock: 'Initiative'      // default: 'Big Rock'
}
```

**Affected UI Areas:**
- Navigation menu labels
- Page titles and headers
- Form field labels and placeholders
- Button text ("Add Objective" → "Add Outcome")
- Help text and tooltips
- AI-generated suggestions (include vocabulary in AI context)

**Business Value:**
- Familiar terminology increases user adoption
- Reduces training overhead for organizations with existing frameworks
- Smoother migration path from Viva Goals
- Enterprise customization requirement

**Dependencies:**
- Schema change to tenants table
- React context for vocabulary distribution

---

### 9. Governance & Audit Enhancements ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 4-5 weeks

**Description:**
Compliance features for regulated industries and enterprise governance.

**Features:**
- Audit log for all changes (who, what, when)
- Change approval workflows (require approval for strategic changes)
- Version history for all documents
- Compliance reports (SOC 2, ISO 27001 evidence)
- Data retention policies
- GDPR/privacy controls (data export, right to deletion)

**Business Value:**
- Enterprise sales requirement
- Compliance with regulations
- Risk mitigation

---

### 10. Strategic Alignment Mind Map ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 2-3 weeks

**Description:**
Interactive visual graph showing how company values, annual goals, strategies, objectives, key results, and big rocks interconnect, filtered by time period.

**Features:**
- React Flow-based interactive graph visualization
- Time period filtering (fiscal year + quarter selector)
- Custom node types for each entity (Values, Goals, Strategies, Objectives, KRs, Big Rocks)
- Distinct edge styling for different relationship types:
  - Values → Goals (foundational alignment)
  - Goals → Strategies (strategic alignment)
  - Strategies → Objectives (execution alignment)
  - Objectives → Key Results (measurement hierarchy)
  - Objectives/KRs → Big Rocks (initiative linking)
  - Big Rocks → Strategies (strategic initiative alignment)
- Auto-layout algorithm with hierarchical positioning
- Interactive features:
  - Hover to highlight connected nodes
  - Click node to view details
  - Pan/zoom controls
  - Toggle visibility by entity type
- Legend explaining node colors and edge types
- Export as PNG/SVG for presentations

**API Endpoint:**
- `GET /api/mindmap/data?tenantId={id}&quarter={q}&year={y}` 
- Returns all interconnected entities with relationships for the specified time period

**Business Value:**
- Visual clarity on strategic alignment
- Quick identification of gaps (unlinked strategies, underutilized values)
- Executive communication tool for board presentations
- Validates strategic coherence across the organization
- Helps consultants diagnose alignment issues

**Technical Notes:**
- Use `@xyflow/react` (formerly react-flow-renderer) for graph rendering
- Transform existing relationships into graph nodes/edges format
- Leverage existing backend relationships (linkedGoals, linkedStrategies, objectiveId, keyResultId)
- Build on existing ValuesAlignmentWidget analytics patterns

**Dependencies:**
- Install `@xyflow/react` package
- Existing relationship data (already implemented)
- No schema changes required

---

### 10a. Check-in UX Improvements ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 1-2 days

**Description:**
Smart prompts during check-in to guide users toward appropriate actions when Key Results or Big Rocks reach completion milestones.

**Features:**
- **Exceeded Target Prompt (Viva Goals-style):** When checking in on a Key Result that has already exceeded its target value (100%+ progress), display a prompt: "It looks like you're done working on this KPI. Do you want to close it instead?" with Dismiss and Close options
- If user clicks "Close", set status to 'closed' and mark as complete
- If user clicks "Dismiss", allow normal check-in to proceed
- Similar prompt for Big Rocks at 100% completion

**UX Reference:**
![Viva Goals close prompt](attached_assets/image_1764598390531.png)

**Business Value:**
- Reduces clutter from completed items
- Guides users to proper workflow (close vs. continue checking in)
- Matches familiar Viva Goals behavior for migrating users

**Technical Notes:**
- Check `currentValue >= targetValue` (for increase metrics) or equivalent logic before showing check-in form
- Add confirmation dialog component
- Update check-in endpoint to handle close action

**Dependencies:** None

---

### 10b. OKR Cloning (Viva Goals-style) ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3-5 days

**Reference:** https://learn.microsoft.com/en-us/viva/goals/cloning-objectives

**Description:**
Clone objectives to streamline the OKR process - either duplicating OKRs across teams or rolling over unfinished objectives to new time periods while preserving historical progress.

**Use Cases:**

1. **Cross-functional collaboration:** Copy OKRs between teams when multiple teams need aligned objectives with slight modifications
2. **Quarterly rollover:** Clone unfinished Q2 objectives to Q3, resetting progress for the new period while preserving Q2 history

**Clone Dialog Options:**
- **Time Period:** Select target quarter/year (defaults to current period)
- **Owner:** Keep original owner OR assign new owner (applies to entire hierarchy)
- **Scope:**
  - Clone only the objective (no children)
  - Clone objective and immediate children (Key Results only)
  - Clone objective and all children (full hierarchy including nested objectives)

**Single Clone:**
- Hover action menu on any objective row → "Clone" option
- Opens clone dialog with options above
- Creates duplicate with reset progress (0%) in target time period

**Bulk Clone:**
- Checkbox selection on multiple objectives
- "Clone Selected" action in bulk action bar
- Only open objectives can be bulk cloned (closed must be cloned individually)
- Async operation with progress indicator

**API Endpoints:**
- `POST /api/okr/objectives/:id/clone` - Clone single objective
- `POST /api/okr/objectives/bulk-clone` - Clone multiple objectives

**Request Schema:**
```typescript
{
  targetQuarter: number,
  targetYear: number,
  keepOriginalOwner: boolean,
  newOwnerId?: string,
  cloneScope: 'objective_only' | 'immediate_children' | 'all_children'
}
```

**Business Value:**
- Faster OKR setup for recurring objectives
- Preserves historical data while enabling fresh starts
- Enables template-style OKR reuse across teams
- Matches Viva Goals workflow for migrating users

**Technical Notes:**
- Deep clone must preserve all relationships (strategies, values, Big Rocks)
- Reset progress/currentValue to 0 on cloned items
- Reset status to 'not_started'
- Generate new IDs for all cloned entities
- Maintain parent-child relationships in cloned hierarchy

**Dependencies:** None

---

### 10c. Key Result Weighting ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 2-3 days

**Reference:** Viva Goals weighted rollup feature

**Description:**
Allow users to adjust how much each Key Result contributes to its parent objective's overall progress. Currently all Key Results contribute equally; this feature enables weighted contributions.

**Example:**
- KR1 (weight 60%) at 100% complete = 60 points
- KR2 (weight 40%) at 50% complete = 20 points
- **Objective progress = 80%** (weighted average)

**Features:**
- Add optional `weight` field (0-100) to Key Results
- Default: null (auto-equal weighting when no weights specified)
- When any KR has explicit weight, normalize all weights to sum=100%
- Inline weight editing in OKR detail pane
- "Distribute Equally" quick action button
- Weight chips displayed in hierarchy view for visibility
- Weighted progress calculation in rollup

**UI/UX:**
- Editable numeric inputs in objective detail pane (Overview tab)
- Percent format with validation (0-100)
- Visual indicator when weights don't sum to 100%
- Tooltip explaining weighted vs. equal rollup behavior

**API Changes:**
- Add `weight` column to `key_results` table (doublePrecision, nullable)
- Update insert/update schemas
- Modify progress rollup calculation in `getObjectiveHierarchy`

**Business Value:**
- Enables prioritization of high-impact Key Results
- More accurate objective progress representation
- Matches Viva Goals weighted rollup behavior
- Essential for strategic OKR management

**Dependencies:** None

---

### 10d. OKR Alignment (Cross-Team Linking) ⭐ NEW

**Status:** Not Started  
**Priority:** Medium  
**Effort:** 3-5 days

**Reference:** https://learn.microsoft.com/en-us/viva/goals/viva-goals-healthy-okr-program/align-okrs-overview

**Description:**
Allow objectives to align (link) to other objectives across teams and organizational levels, enabling visibility into how team goals support broader organizational priorities. This is distinct from parent-child hierarchy—it's about strategic alignment across silos.

**Alignment Types:**

1. **Vertical Alignment (Up):** Team objective aligns up to organization-level objective
2. **Horizontal Alignment (Across):** Team objective aligns to another team's objective for cross-functional collaboration
3. **Multiple Alignment:** Single objective can align to multiple parent objectives

**Features:**
- "Align to Objective" action in objective detail pane and hover menu
- Objective picker modal with search and filtering by:
  - Organization/Team/Division level
  - Time period (quarter/year)
  - Owner
- Display aligned objectives in detail pane (new "Alignment" tab or section)
- Visual indicators in hierarchy view showing alignment relationships
- Alignment badges showing count of aligned objectives
- Bidirectional visibility (parent sees aligned children, child sees aligned parents)

**Schema Changes:**
```typescript
// New junction table for many-to-many objective alignment
objectiveAlignments: {
  id: uuid primary key,
  sourceObjectiveId: uuid (FK to objectives),
  targetObjectiveId: uuid (FK to objectives),
  alignmentType: enum('vertical', 'horizontal'),
  createdAt: timestamp,
  createdBy: uuid (FK to users)
}
```

**API Endpoints:**
- `POST /api/okr/objectives/:id/align` - Create alignment
- `DELETE /api/okr/objectives/:id/align/:targetId` - Remove alignment
- `GET /api/okr/objectives/:id/alignments` - Get all alignments for objective

**Business Value:**
- Breaks down organizational silos
- Provides transparency on how team work connects to company priorities
- Enables cross-functional collaboration tracking
- Matches Viva Goals alignment model for migrating users
- Critical for enterprise OKR programs

**Technical Notes:**
- Prevent circular alignments (A→B→C→A)
- Consider alignment in progress rollup (optional future enhancement)
- Index sourceObjectiveId and targetObjectiveId for query performance

**Dependencies:** None

---

## LOWER PRIORITY / FUTURE

### 11. Advanced AI Features ⭐ NEW

**Status:** Not Started  
**Priority:** Low  
**Effort:** TBD

**Features:**
- Predictive analytics (forecast OKR completion probability)
- Variance detection (alert on unusual patterns)
- Sentiment analysis on meeting notes
- Automated insights ("Your team is behind on 3 objectives")
- **AI Big Rock Suggestions** ⭐ NEW: Analyze existing objectives, key results, strategies, and annual goals to:
  - Identify execution gaps (objectives without supporting initiatives)
  - Suggest new Big Rocks to close strategic gaps
  - Recommend Big Rock assignments based on team capacity
  - Generate draft Big Rock descriptions with success criteria
  - Priority scoring based on strategic alignment and value tagging

**Business Value:** Differentiation, but not essential for launch.

---

### 12. Sector-Specific Playbooks ⭐ NEW

**Status:** Not Started  
**Priority:** Low  
**Effort:** Ongoing (content creation)

**Description:**
Pre-built Company OS templates for different industries.

**Examples:**
- SaaS startup playbook
- Professional services playbook
- Manufacturing playbook
- Non-profit playbook

**Business Value:** Faster time-to-value, consultant enablement.

---

### 13. Microsoft 365 Deep Integration

**Status:** Infrastructure Ready  
**Priority:** Low (superseded by Entra SSO backlog item)  
**Effort:** Covered in Entra SSO Phase 2

**Description:**
See "Microsoft Entra SSO Integration" (High Priority #2) for full scope.

**Notes:**
- Microsoft Graph Client already in dependencies
- Will be implemented as part of Entra SSO Phase 2

---

### 13. Employee Experience & Engagement ⭐ NEW

**Status:** Not Started  
**Priority:** Low  
**Effort:** TBD

**Description:**
Features to drive employee adoption and engagement with the Company OS.

**Potential Features:**
- Gamification (badges, achievements)
- Personal OKRs linked to team objectives
- Progress notifications and celebrations
- Social features (comments, likes on achievements)
- Mobile app for on-the-go updates

**Business Value:** Increases adoption, but not critical for B2B consultant model.

---

## Recently Completed ✅

### ✅ Dashboard Resilience (November 2025)
Per-section error handling to prevent entire dashboard failure.

### ✅ Values with Descriptions (November 2025)
Enhanced values model to include both title and description.

### ✅ Enhanced OKR System (November 2025)
Hierarchical objectives, weighted key results, rollup progress calculation.

### ✅ Check-In History & Editing (November 2025)
Full check-in history with inline editing capabilities.

### ✅ Entity Relationship Linking (November 2025 - Partial)
- Objectives can link to Strategies and Annual Goals
- Strategies can link to Annual Goals
- Big Rocks can link to Strategies

---

## Quick Wins (Can be done in <1 week)

1. **Fix Values alignment dashboard widget** - Currently incomplete (see #4), needs accurate counting across all hierarchy levels
2. **Email notifications for OKR updates** - Leverage existing SendGrid integration
3. **Keyboard shortcuts** - Power user efficiency
4. **Dark mode refinements** - Already implemented, just needs polish
5. **Export OKRs to CSV** - Simple data export for Excel analysis

---

## Parking Lot (Ideas for Future Consideration)

- Slack/Teams integration for notifications
- Public API for third-party integrations
- Webhooks for external systems
- Mobile app (native iOS/Android)
- Offline mode with sync
- Multi-language support (i18n)
- Advanced charting (Gantt charts, burndown charts)
