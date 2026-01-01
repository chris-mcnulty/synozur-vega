# Vega Platform Master Backlog

**Last Updated:** December 31, 2025

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

### Current Status Assessment (December 31, 2025)

| Item | Status | Notes |
|------|--------|-------|
| **RBAC** | ✅ 100% | Complete. Fine-grained permissions implemented. |
| **M365 Multi-Tenant** | ✅ ~90% | SSO, Planner, SharePoint/OneDrive, Admin Consent, Outlook Calendar complete. |
| **Focus Rhythm** | ✅ ~85% | Decisions/Risks UI, OKR linking, meeting templates complete. |
| **Culture & Values** | ✅ Complete | |
| **M365 Copilot Agent** | ~60% | OpenAPI spec ✅, Declarative manifest ✅, API plugin ✅, OAuth setup pending |
| **AI-Powered Assistance** | ~40% | 7 AI tools implemented. Q&A chat with function calling works. |
| **AI Usage Reporting** | ✅ Complete | Full implementation with Tenant + Platform admin UI |
| **Enhanced Reporting** | ✅ ~80% | PDF + PPTX export complete. Snapshot comparison remaining. |
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
PHASE 1: M365 Copilot Agent Completion (January 2025)
├── OAuth setup in Copilot Studio (pending client Azure AD setup)
├── Testing in M365 dev tenant
└── Client deployment + refinement

PHASE 2: UX Enhancements (January-February 2025)
├── Unified Time Period Selector (1 week)
├── Contextual Breadcrumbs (1 week)
└── OKR Creation Wizard (2 weeks)

PHASE 3: Advanced Features (February-March 2025)
├── Strategy Cascade Visualization (2-3 weeks)
├── OKR Health Scoring & Predictive Analytics (3-4 weeks)
└── Cross-Team Dependencies & Collaboration Hub (2-3 weeks)
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
- Vector database for semantic search (pgvector)
- AI-powered search across OKRs
- Meeting prep AI with context retrieval
- Predictive analytics

---

## MEDIUM PRIORITY FEATURES

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

## LOWER PRIORITY / FUTURE FEATURES

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

### Enhancement 1: Contextual Breadcrumbs with Quick Actions

**Status:** Documented, Not Implemented  
**Effort:** 1 week  
**Priority:** High

Display navigation path with interactive elements:
```
Planning > Q4 2025 > Marketing Team > Objective > Key Result
```

Features:
- Quick action menu on each breadcrumb segment
- Smart truncation for long paths
- Type indicators (icons) for each level

---

### Enhancement 2: Unified Time Period Selector

**Status:** Documented, Not Implemented  
**Effort:** 1 week  
**Priority:** Critical (RECOMMENDED NEXT)

Global time period component in header:
- Consistent quarter/year selection across modules
- Persistent selection as user navigates
- Quick shortcuts (Current Quarter, Previous Quarter, etc.)

---

### Enhancement 3: Streamlined OKR Creation Wizard

**Status:** Documented, Not Implemented  
**Effort:** 2 weeks  
**Priority:** High

Multi-step wizard: Objective → Key Results → Big Rocks → Review
- Create complete OKR hierarchy in one session
- AI suggestions integrated throughout
- Draft auto-save functionality
- Template library

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

## FEATURE PROPOSALS

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

### Global Command Palette & Keyboard Shortcuts

**Effort:** 1 week  
**Priority:** Medium

Power-user feature (⌘K / Ctrl+K) for fuzzy searching and quick actions:
- Search across all entities
- Navigate shortcuts (G then D for Dashboard, etc.)
- Action commands (New Objective, Quick Check-in)

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

### Progress Timeline & Activity Feed

**Effort:** 1-2 weeks  
**Priority:** Medium

Visual progress trends and real-time activity feed:
- Interactive line charts showing KR progress over time
- Global activity feed with filters
- Sparkline mini-charts on objective cards

---

## BUSINESS SUCCESS OPTIMIZATION

### Pillar 1: Predictive Intelligence Engine

Transform Vega from tracking what happened to predicting what will happen:
- Probabilistic outcome forecasting with Monte Carlo simulations
- Leading indicator detection
- Organizational stress detection

### Pillar 2: Behavioral Science Integration

Apply habit science to make high-performance behaviors automatic:
- Smart timing for check-in nudges
- Habit-forming check-in system with streaks
- Commitment devices and premortem prompts
- Social proof engine

### Pillar 3: Organizational Network Intelligence

Map and optimize informal networks:
- Collaboration graph visualization
- Influence mapping
- Automatic dependency detection
- Meeting intelligence and ROI dashboard

### Pillar 4: Adaptive Learning System

Build a self-improving organization:
- Automated retrospectives at quarter-end
- OKR quality scoring during creation
- Pattern library from successful organizations
- Skill gap analysis

### Pillar 5: Ecosystem Orchestration

Position Vega as the strategic layer above all operational tools:
- Universal data connectors (Salesforce, Jira, GitHub, etc.)
- Bi-directional action orchestration
- Strategic command center

### Pillar 6: Consultant-as-a-Platform

Scale strategic consulting through AI:
- AI-powered diagnostic assessments
- Guided implementation playbooks
- Best practice recommendations

---

## KNOWN ISSUES & BUGS

### Production SSO Session Persistence Bug ✅ FIXED

**Status:** Resolved (December 2025)

Session cookie now persists correctly after Microsoft SSO redirect.

---

### Microsoft Planner Integration Issues

**Status:** Partially Working  
**Severity:** Medium

Current Issues:
1. Token dependency on Outlook connection
2. Scope limitations (read-only with Tasks.Read)
3. Rate limiting (100 req/10 sec)
4. No automatic sync scheduler

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
- `pgvector` - For semantic search (extension to enable)

---

**For questions about this backlog, consult replit.md for project architecture context.**
