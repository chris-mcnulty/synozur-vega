# Vega Platform Changelog

All notable changes, features, and updates to the Vega Platform are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project follows semantic versioning principles.

---

## [Current Release] - January 2026

### 🎯 Completed Features & Enhancements

#### Executive Dashboard & Intelligence
- **Executive Dashboard Personalization** - Added to backlog as high priority feature
  - Customizable dashboard layouts with drag-and-drop
  - Threshold configuration for pace, risk, and stale items
  - Section visibility controls and item count limits
  - Default filter preferences

- **OKR Intelligence Phase 1** ✅ COMPLETE (January 9, 2026)
  - Pace status calculation (on-track, ahead, behind)
  - PaceBadge component with visual indicators
  - Behind Pace alerts on Executive Dashboard
  - Velocity projection showing projected end progress
  - Risk signal badges (Stalled, Attention Needed)
  - Implemented across Outcomes module and Executive Dashboard

#### Core OKR System

- **RBAC Enforcement** ✅ COMPLETE (January 1, 2026)
  - 6 roles defined: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`
  - 20+ permissions with fine-grained controls
  - Ownership checks (UPDATE_OWN_OKR vs UPDATE_ANY_OKR)
  - Server-side helpers: `canUserModifyOKR()` and `canUserDeleteOKR()`
  - Frontend permission-aware UI with `usePermissions()` hook
  - Conditional edit/delete buttons in UI components

- **OKR Period Close-Out** ✅ COMPLETE (December 31, 2025)
  - Pacific Time detection for accurate period tracking
  - Prompts to continue in new period or close
  - Mandatory closing notes when closing objectives/KRs
  - Amber styling for period-ended, green for target-exceeded
  - Closing notes persisted to database

- **Key Result Weighting** ✅ COMPLETE (December 31, 2025)
  - Weight field with default value of 25
  - WeightManager component with auto-balance, normalize, and lock features
  - Weight badges in HierarchicalOKRTable with lock indicator
  - Weight display in OKRDetailPane showing contribution percentage
  - Weighted progress calculation in objective rollup

- **OKR Cloning** ✅ COMPLETE (December 20, 2025)
  - Clone objectives with scope options (only objective, immediate children, full hierarchy)
  - Target quarter/year selection
  - Owner assignment options (keep or reassign)
  - Progress reset to 0%

- **Objective Alignment** ✅ COMPLETE
  - `alignedToObjectiveIds` many-to-many relationship
  - "Aligned to" section in OKRDetailPane
  - Alignment dialog in PlanningEnhanced
  - Full API support for updating alignments

#### Microsoft 365 Integration

- **M365 Multi-Tenant Integration** ✅ ~90% COMPLETE
  - Multi-tenant MSAL config with `/common` authority
  - Microsoft Entra ID login/callback flow
  - JIT user provisioning from SSO
  - Tenant mapping via `azureTenantId` or email domain
  - SSO policy enforcement
  - Planner Integration with OAuth consent
  - OneDrive/SharePoint file picker
  - Admin consent endpoints
  - Outlook Calendar sync
  - Remaining: Excel data binding, incremental consent for Mail.Send

- **M365 Copilot Agent** ~60% COMPLETE
  - ✅ OpenAPI 3.0 specification at `/openapi.yaml` and `/openapi.json`
  - ✅ Declarative agent manifest (v1.6)
  - ✅ API plugin manifest with OAuth config
  - ✅ Response formatting helpers
  - Pending: OAuth setup in Copilot Studio, testing, client deployment

#### AI & Intelligence

- **AI-Powered Assistance** ~40% COMPLETE
  - 7 AI tools with function calling implemented
  - Streaming chat interface
  - Grounding Documents system with tenant-specific context
  - AI usage tracking for cost analysis
  - Remaining: Vector database (pgvector), semantic search, meeting prep AI, predictive analytics

- **AI Usage Reporting** ✅ COMPLETE (December 17, 2025)
  - Full implementation with Tenant + Platform admin UI
  - Provider and model usage tracking
  - Cost analysis capabilities

- **Launchpad** ✅ COMPLETE (December 20, 2025)
  - AI-powered document-to-Company OS generator
  - Extracts mission, vision, values, and goals from uploaded documents
  - Strategic document analysis

#### Team & Collaboration

- **Team Mode** ✅ COMPLETE
  - `/team` route with filtered views
  - Simplified interface for weekly team execution
  - Focus on relevant KRs and Big Rocks

- **Team Management** ✅ COMPLETE (December 20, 2025)
  - Full CRUD UI in Tenant Admin
  - Team table with name, description, leader, member count
  - Create/edit/delete teams functionality
  - Member management interface
  - API routes for all team operations

- **Focus Rhythm** ✅ ~85% COMPLETE
  - Decisions/Risks UI
  - OKR linking to meetings
  - Meeting templates
  - Auto-generated agendas
  - Search functionality

#### Customization & Branding

- **Customizable Branding** ✅ COMPLETE (December 2025)
  - White-label deployment support
  - Logo URLs (primary, dark mode, favicon)
  - Color scheme customization
  - Report branding
  - Dark mode logo support in sidebar

- **Custom Vocabulary** ✅ COMPLETE (December 2025)
  - VocabularyContext with system-level defaults
  - Tenant-level overrides
  - Customizable terminology (Objective → Outcome, Key Result → Metric, etc.)

#### Data Management

- **Enhanced Reporting** ✅ ~80% COMPLETE
  - PDF export functionality
  - PPTX export functionality
  - Remaining: Snapshot comparison

- **Export/Import System** ✅ COMPLETE (December 2025)
  - Export complete Company OS data
  - `.cos` JSON file format
  - Duplicate handling strategies
  - ID remapping for cross-tenant imports
  - Full data portability

#### UX Improvements

- **Organized Navigation** ✅ COMPLETE (December 30, 2025)
  - Collapsible sidebar sections:
    - 📊 Execute (Dashboard, Team Mode)
    - 🎯 Plan & Align (Foundations, Strategy, Planning)
    - 📅 Review & Learn (Focus Rhythm)
    - ⚙️ Manage (Admin tools)
    - 🛡️ Platform (System Admin)
    - 👤 Personal (Settings, Guide, About)
  - Persistent collapsed/expanded state
  - Smart auto-expand for active page
  - Role-based visibility
  - Smooth 200ms animations

### 🐛 Bug Fixes

- **Production SSO Session Persistence Bug** ✅ FIXED (December 2025)
  - Session cookie now persists correctly after Microsoft SSO redirect

### 📋 Known Issues

- **Microsoft Planner Integration** - Partially working (Medium severity)
  - Token dependency on Outlook connection
  - Scope limitations (read-only with Tasks.Read)
  - Rate limiting (100 req/10 sec)
  - No automatic sync scheduler

- **Microsoft SharePoint Integration** - Partially working (Medium severity)
  - Sites.Selected permission limitations
  - URL resolution issues on certain formats
  - Drive discovery may miss some libraries

- **TypeScript Circular Reference** - Known (Low severity)
  - Self-referencing types in `shared/schema.ts` cause implicit 'any' warnings
  - Does not affect runtime

### 🔧 Technical Improvements

- **Database Performance** (January 2026)
  - Added performance indexes via migration `0001_add_performance_indexes.sql`
  - Optimized query patterns

---

## [Planned Features] - Roadmap

### High Priority

1. **M365 Copilot Agent Completion** (January 2025)
   - OAuth setup in Copilot Studio
   - Testing in M365 dev tenant
   - Client deployment + refinement

2. **Executive Dashboard Personalization** (2-3 weeks)
   - Section visibility controls
   - Layout rearrangement with drag-and-drop
   - Threshold configuration
   - Default filters

3. **Unified Time Period Selector** (1 week)
   - Global time period component in header
   - Consistent quarter/year selection across modules
   - Persistent selection as user navigates
   - Quick shortcuts

4. **Contextual Breadcrumbs** (1 week)
   - Display navigation path with interactive elements
   - Quick action menu on each breadcrumb segment
   - Smart truncation for long paths

### Medium Priority

1. **OKR Intelligence Phase 2** - Trend Visualization
   - Sparkline charts showing progress over time
   - Velocity trend analysis
   - Confidence bands on projections

2. **Premium Feature Gating System** (2-3 weeks)
   - Feature entitlement by service plan
   - `useFeature(slug)` hook
   - `<FeatureGate>` wrapper component
   - Upgrade modal with plan comparison

3. **Objective Alignment Visual Indicator** (2-3 days)
   - Visual badge/icon on aligned objectives
   - Alignment arrow with parent objective name
   - Quick "Align to..." action
   - Alignment count badge on parent objectives

4. **Strategic Alignment Mind Map** (2-3 weeks)
   - Interactive visual graph using React Flow
   - Shows connections between values, goals, strategies, objectives, KRs, and big rocks

### Feature Proposals

1. **Help Chatbot & Support Ticket System** (2-3 weeks)
   - AI-powered help bot grounded on user guide
   - Support ticket system with email notifications
   - In-app ticket tracking

2. **AI Check-in Note Rewriter** (3-5 days)
   - Context-aware note improvement
   - Multiple rewrite modes (clarity, concise, expand)
   - Integrated into check-in dialog

3. **Tenant Snapshot & Recovery System** (3-4 weeks)
   - Daily automated snapshots (premium feature)
   - 30-90 day retention based on plan
   - Point-in-time recovery

4. **Company OS Document Export** (1-2 weeks)
   - Comprehensive document generation
   - Markdown format (PDF/PPTX future)
   - Filtering by level, team, period, status

### Business Success Optimization

**Phase 1: Foundation (Q1 2026)**
- OKR Quality Scoring ✅
- Automated Retrospectives
- Enhanced Dependency Risk
- Check-in Habit Features

**Phase 2: Intelligence (Q2 2026)**
- Probabilistic Outcome Forecasting
- Collaboration Graph
- Leading Indicator Detection
- Meeting Intelligence

**Phase 3: Ecosystem (Q3 2026)**
- CRM Integration (Salesforce, HubSpot)
- Product Tool Integration (Jira, Linear)
- Strategic Command Center
- Bi-directional Workflows

**Phase 4: Transformation (Q4 2026)**
- Virtual Strategy Consultant
- Self-Service Transformation Journeys
- Certification Platform
- Cross-Organization Benchmarking

---

## Technical Architecture

### Current Stack
- **Frontend**: React + TypeScript, Wouter, shadcn/ui (Radix UI), TailwindCSS
- **Backend**: Express.js + Node.js, PostgreSQL (Neon), Drizzle ORM
- **Authentication**: Session-based with Microsoft Entra ID SSO support
- **AI**: GPT-5 via Replit AI Integrations
- **Email**: SendGrid
- **Storage**: Google Cloud Storage / Azure Blob

### Key Design Decisions
- **ADR-001**: Session-based authentication (not JWT)
- **ADR-002**: Multi-tenancy via tenantId FK
- **ADR-003**: PostgreSQL with Drizzle ORM
- **ADR-004**: UUID primary keys
- **ADR-005**: TanStack Query for state management
- **ADR-006**: Shadcn/UI component library
- **ADR-007**: Pacific Time for all date operations

---

## Support & Documentation

For detailed feature information and upcoming roadmap items, see [BACKLOG.md](./BACKLOG.md).

For user documentation, see [USER_GUIDE.md](./USER_GUIDE.md).

For technical documentation, see [README.md](./README.md).

---

**Last Updated**: January 10, 2026
