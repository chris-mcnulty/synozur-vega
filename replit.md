# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application that functions as a comprehensive Company Operating System (Company OS). Its core mission is to align organizational strategy with execution through AI-powered modules that cover foundational elements, strategic planning, and focus rhythm management. The platform supports both consultant-led and self-service approaches, integrates with Microsoft 365, and maintains a consistent UI/UX with Orion.synozur.com for brand continuity. The overarching goal is to offer a holistic solution for companies to manage and effectively implement their strategic objectives.

## User Preferences
Preferred communication style: Simple, everyday language.

## Standing Instructions
- **Keep USER_GUIDE.md current**: When new features or capabilities are added to Vega, update the USER_GUIDE.md file to document them for end users. This file is the primary user-facing documentation.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Wouter for routing, and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **UI/UX Decisions**: Mimics Orion.synozur.com's aesthetic, emphasizing whitespace, card-based layouts, and subtle animations.
- **Technical Implementations & Feature Specifications**:
    - **Company OS Dashboard**: Provides a real-time overview of Foundations (mission, vision, values, annual goals), Strategies, Quarterly OKRs, Big Rocks, and upcoming meetings, with per-section error handling.
    - **Foundations Module**: Manages mission, vision, values, and annual goals, incorporating AI suggestions. Values include both title and description.
    - **Strategy Module**: Facilitates strategy management with AI drafting and goal alignment (many-to-many relationship with annual goals).
    - **Planning Module**: Implements an enhanced OKR system with hierarchical objectives, Key Results, and "big rocks" (initiatives). Key Result progress is weighted and rolls up to parent objectives. Big Rocks can link to multiple strategies.
    - **Focus Rhythm**: Full meeting management with OKR alignment, meeting templates, OKR linking modal, auto-generated agendas, and full-text search.
    - **Tenant Admin**: Manages organization, M365 integration status, tenant/user CRUD, and allowed email domains.

### Backend
- **Server**: Express.js with Node.js, providing a RESTful API (`/api` prefix).
- **Data Storage**: PostgreSQL with Drizzle ORM, using UUIDs for primary keys and foreign key relationships.
- **System Design Choices**:
    - `IStorage` interface for CRUD operations, implemented by `DatabaseStorage`.
    - Session-based authentication using Express sessions and `connect-pg-simple`, secure password hashing (bcryptjs), and SendGrid integration for email verification.
    - **Microsoft Entra ID SSO**: Multi-tenant MSAL-based Azure AD authentication with PKCE flow, just-in-time user provisioning, and tenant mapping via `azureTenantId` or email domain. Uses 'common' authority for true multi-tenant support.
      - **SSO Policy Enforcement**: Tenant-level SSO policies (enforceSso, allowLocalAuth) enforced both client-side and server-side. Login page checks `/auth/entra/check-policy` endpoint to determine SSO requirements and shows appropriate UI. Server-side blocks password login attempts when SSO is required.
      - **Error Handling**: User-friendly error messages for SSO failures, including consent required, access denied, and tenant not registered scenarios.
    - Multi-tenancy with data isolation per tenant, managed via `TenantContext` and `TenantSwitcher`, supporting tenant-specific branding, email domains, and SSO configuration.
    - Full RBAC enforcement with 6 roles: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`.

### Development & Tools
- **Development Server**: Vite for client, esbuild for server, with HMR.
- **Type Safety**: TypeScript.
- **Form Management**: React Hook Form with Zod schemas for validation.
- **Date Handling**: `date-fns`.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for integrations with Excel, Outlook Calendar, and Microsoft Planner, utilizing OAuth.
  - **Planner Integration**: Full Microsoft Planner integration with per-user OAuth consent flow. Users connect their Planner accounts via Settings page. Supports bidirectional sync of plans, buckets, and tasks. Tasks can be linked to OKRs (objectives) and Big Rocks via many-to-many relationships. Database tables: `planner_plans`, `planner_buckets`, `planner_tasks`, `graph_tokens`, `objective_planner_tasks`, `big_rock_planner_tasks`. API routes at `/api/planner/*` and auth routes at `/auth/entra/planner/*`.
    - **Security**: OAuth tokens encrypted at rest using AES-256-GCM with PBKDF2 key derivation (requires `TOKEN_ENCRYPTION_SECRET` env var, min 32 chars). All Planner routes protected with tenant-scoped authorization middleware. Ownership validation ensures users can only access plans/tasks within their tenant.
- **AI Services**: GPT-5 integration via Replit AI Integrations (OpenAI-compatible API), supporting streaming chat, OKR suggestions, and Big Rock suggestions. AI context is enhanced via a Grounding Documents system.
  - **AI Usage Tracking**: Database tables `ai_usage_logs` and `ai_usage_summaries` track all AI API calls with provider, model, token counts, costs, and latency. Designed to support provider switching (Replit AI → Azure OpenAI → Anthropic) and measure impact of model changes (GPT-4 → GPT-5 → Claude). See `AI_PROVIDERS` and `AI_FEATURES` enums in `shared/schema.ts`.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector).

## Test Accounts

**Test credentials are stored as secrets - never hardcode passwords in files.**

| Email | Password Secret | Role |
|-------|-----------------|------|
| chris.mcnulty@synozur.com | TEST_ACCOUNT_PASSWORD | vega_admin (primary owner) |
| admin@synozur.com | TEST_ACCOUNT_PASSWORD | vega_admin |

**Testing Instructions:**
- Use secrets for authentication in tests
- Never expose credentials in code or documentation

## Feature Backlog

> **📋 Complete Backlog:** See [BACKLOG.md](./BACKLOG.md) for the full prioritized backlog with effort estimates, blocking issues, junior developer quick wins, and detailed implementation notes.

### Completed
- [x] **RBAC Standardization**: Comprehensive permission-based access control using central middleware system across all route files
- [x] **Tenant-level M365 Connector Configuration**: Toggle switches for OneDrive, SharePoint, Outlook, Excel, and Planner services per tenant
- [x] **Multi-tenant Admin Consent Flow**: Three endpoints for admin consent initiation, callback, and status checking with AES-256-GCM state encryption
- [x] **Admin Consent Tracking**: Schema fields (adminConsentGranted, adminConsentGrantedAt, adminConsentGrantedBy) and UI in Tenant Admin page
- [x] **Microsoft Planner Integration**: Full bidirectional sync with per-user OAuth consent, encrypted token storage, task linking to OKRs/Big Rocks
- [x] **Outlook Calendar Integration**: Per-user OAuth consent flow for Outlook Calendar access. Service-scoped Graph tokens (`graph_tokens.service` column) allow separate connections for Planner and Outlook. OutlookConnectionCard in Settings page. API routes at `/api/outlook/*` for calendars and events. Auth routes at `/auth/entra/outlook/*` for OAuth flow.
- [x] **Excel Data Binding for Key Results**: URL paste support for OneDrive/SharePoint Excel files with cell reference binding
- [x] **Planner Progress Mapping**: Map Key Results or Big Rocks to Planner plans/buckets to derive progress from task completion percentage. Schema fields (`plannerPlanId`, `plannerBucketId`, `plannerSyncEnabled`, `plannerLastSyncAt`, `plannerSyncError`), API endpoints for mapping management and progress sync, PlannerProgressMapping UI component in Key Result detail pane. Automatic schema migration on startup via `ensureSchemaColumns()` in server/init.ts.
- [x] **Objective Alignment/Laddering**: Many-to-many objective alignment allowing team/individual objectives to "ladder up" or support multiple org-level objectives. Schema field `alignedToObjectiveIds` on objectives table. "Link Existing Objective" menu option in HierarchicalOKRTable. Alignment dialog for selecting/toggling objective alignments. Aligned objectives displayed as "virtual children" under target objectives with Link2 icon and purple styling to distinguish from direct children.
- [x] **Vocabulary Module**: Customizable terminology for core objects (Goals, Strategies, Objectives, Key Results, Big Rocks, Meetings, Focus Rhythm). System-level defaults in `system_vocabulary` table managed via System Admin page (platform admins only). Tenant-level overrides in `vocabularyOverrides` JSONB field on tenants table, configured via Tenant Admin page. VocabularyContext provides `useVocabulary` hook with `t(term, 'singular'|'plural')` helper. Dashboard and other key UI components use vocabulary context for dynamic terminology.

### Focus Rhythm Enhancements (Priority: Medium) - COMPLETE
- [x] Rich agenda with live OKR links that show current progress (color-coded status indicators: green ≥70%, yellow 40-69%, red <40%)
- [x] Import meeting notes from Outlook Calendar (via `/api/m365/calendar/events` endpoint with date range filtering)
- [x] AI-powered meeting recap parser (GPT-5 powered extraction of action items, decisions, blockers via `/api/ai/parse-meeting-recap`)
- [x] Meeting templates with pre-configured OKR check-in sections: New OKR Check-in template, enhanced templates with `[OKR]` prefixed items and `--- SECTION ---` headers for visual separation. TemplateSelector shows OKR badge counts.
- [x] Recurring meeting series support: Schema fields (`seriesId`, `isRecurring`, `recurrencePattern`, `recurrenceEndDate`), UI controls in meeting form, recurring badge on meeting cards. Patterns: weekly, biweekly, monthly, quarterly.

### Objective Progress Overview UX Improvements (Priority: Low)
- Sort objectives by level (org first), then by lowest progress to highlight issues
- Status-colored progress bars: Green (≥70%), Yellow (40-69%), Red (<40%)
- Cap display at 100% with "Exceeds Target" badge for >100%
- Add click-to-view to jump to objective details
- Status icons for quick scanning (checkmark, warning, alert)
- Show Key Results count context (e.g., "3/5 KRs complete")
- Filter tabs for At-Risk, On-Track, Completed
- Clear quarter context header

### OpenAPI Spec for M365 Copilot Agent (Priority: High - January 2025 deadline)
- Generate OpenAPI 3.0 spec for all Vega API endpoints
- Focus on OKR CRUD, Big Rock management, and meeting operations
- Support natural language queries about company strategy and progress
- Target SharePoint site: https://synozur.sharepoint.com/sites/Marketing

### Power BI Integration for Key Results (Priority: Medium)
- Link Key Results to Power BI measures from specific reports or dashboards
- Use Power BI measure values as the data source for KR metrics
- Part of M365 connector ecosystem alongside Excel, Planner integrations
- OAuth flow similar to Planner integration for per-user consent
- Periodic sync to pull latest measure values from Power BI

### Team Mode - Simplified Interface (Priority: Medium) - COMPLETE
- [x] **Separate menu option** (not a toggle) - distinct context with URL-addressable route (`/team`)
- [x] Streamlined dashboard view for teams focused on weekly execution
- [x] Shows: Goals, Strategies, Key Results, and Big Rocks relevant to the team
- [x] Primary focus on Key Results and Big Rocks for weekly review meetings
- [x] Hides organizational hierarchy complexity while maintaining data connections
- [x] Designed for less sophisticated organizations and team-level weekly reviews

**Implementation details:**
- TeamDashboard component at `/team` route with dedicated sidebar navigation (Users icon)
- Team selector dropdown for users with multiple team memberships (matrix membership supported)
- Quarter selector with persistence in localStorage
- KRs shown from objectives that belong to the selected team
- Big Rocks filtered by `teamId` field (explicit team assignment)
- Strategies derived from team objectives' linked strategies (not separately owned)
- Summary stats card showing KR count, average progress, and Big Rocks completion
- Color-coded progress bars and status icons for at-a-glance assessment

**Deferred considerations:**
- DRI (Directly Responsible Individual) field on Big Rocks - may imply team membership
- Team-based RBAC (executives see all, team members scoped to their teams)
- Goals/Strategies ownership by team (currently derived through objective relationships)

