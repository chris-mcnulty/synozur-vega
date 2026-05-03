# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application designed as a comprehensive Company Operating System (Company OS). Its primary goal is to align organizational strategy with execution through AI-powered modules covering foundational elements, strategy development, and focus rhythm management. The platform supports both consultant-led and self-service models, integrates with Microsoft 365, and maintains brand continuity via the Aurora Visual System. It aims to provide a holistic solution for strategic objective management and implementation, leveraging AI for insights and streamlined operations to enhance market potential.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
-   **Framework**: React with TypeScript, Wouter for routing, and shadcn/ui (Radix UI) components.
-   **State Management**: React hooks and TanStack Query.
-   **Styling**: TailwindCSS, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design following the Constellation (Oconee) brand standard, specifically the Aurora Visual System for animated backgrounds, gradient texts, glow effects, and specialized card/sidebar designs.
-   **Key Features**:
    -   **Dashboards**: Company OS, Executive (analytics, projections), and Team Dashboards (weekly focus), all loading via a single combined-context API endpoint.
    -   **Core Modules**: Foundations (mission, vision, values, ambitions), Strategy (AI drafting, goal alignment), Outcomes (hierarchical OKRs with mobile-responsive card-stack layout, "big rocks", annual goals with AI suggestions), Focus Rhythm (meeting management with Live Meeting Mode, agenda timers, quick-capture decisions/risks, attendee tracking, and full state persistence), Reporting (PDF/PPTX export).
    -   **Ambitions Module**: Manages 3-5 year strategic targets, linking vision to annual goals with AI suggestions and status tracking.
    -   **AI & Intelligence**: OKR Intelligence for pace/velocity tracking, predictive analytics with completion forecasting, confidence bands, trend detection, risk flagging, and probability distribution visualization. Daily progress snapshots power historical trend charts and period-over-period comparisons. AI-powered document analysis and "What's New" modal.
    -   **Global Search**: Header-level tenant-scoped search across objectives, key results, big rocks, meetings, and people, grouped by entity type and permission-aware.
    -   **In-App Notification Center**: Header bell with unread count, dropdown, and per-event read/unread tracking for assignments, mentions, reminders, and admin alerts.
    -   **Check-in Draft Auto-Save**: Tenant-scoped check-in drafts with auto-save, restore/discard, and clear-on-submit so progress is never lost.
    -   **Bulk Reassignment**: Admin-driven single-action transfer of every objective, key result, and big rock from one owner to another.
    -   **Administration**: Tenant Admin (org, M365 integration, user management) and System Admin (platform-wide AI config, service plans).
    -   **OKR Workflow**: Cloning, Period Close-Out, Mixed Child Rollup Progress Calculation, and an admin-tunable objective hierarchy depth cap with warning alerts.
    -   **Soft Delete & Trash/Recovery**: Strategic items are soft-deleted with a 30-day purge cycle, accessible via an admin-only trash page with restore.
    -   **Vocabulary Module**: Customizable terminology.
    -   **Public Domain Handling**: Enforces invite-only tenants for public email domains.
    -   **Help Chatbot**: AI-powered assistant for support, grounded on documentation, with ticket escalation.
    -   **Support Ticket System**: Manages user tickets with categories, priorities, statuses, email notifications, and staff assignment.

### Backend
-   **Server**: Express.js with Node.js, providing a RESTful API.
-   **Data Storage**: PostgreSQL with Drizzle ORM.
-   **System Design Choices**:
    -   `IStorage` interface for CRUD operations.
    -   Session-based authentication with Express sessions, `connect-pg-simple`, bcryptjs, and SendGrid for email verification.
    -   **Microsoft Entra ID SSO**: Multi-tenant MSAL-based Azure AD authentication with PKCE, JIT user provisioning, and tenant mapping.
    -   Multi-tenancy with data isolation using `TenantContext` and `TenantSwitcher`, enforcing tenant data boundary protection via `req.effectiveTenantId` and database-level filtering.
    -   Full RBAC enforcement with 7 defined roles (including the new read-only `portal_user` role used by the Galaxy Portal trust) and fine-grained OKR permissions.
    -   All date/time operations use America/Los_Angeles timezone.
    -   **Job Scheduler Service**: Manages background jobs, including registration, logging, pause/resume, and failure notifications. New scheduled jobs include the daily progress snapshot capture (per-objective and per-key-result history) and the soft-delete trash purge (30-day retention).
    -   **Weekly AI Digest**: Self-scheduled hourly job (`weekly-digest`) that fires Monday 06:00 in each enabled tenant's local timezone. Sends each opted-in active user an AI-summarized email (narrative + ≤5 Needs Attention + ≤3 Wins) deep-linked into Vega. Per-tenant kill switch (`tenants.weeklyDigestEnabled`, default off) and per-user toggle (`users.notifPrefWeeklyDigest`, default on). Idempotent via `weekly_digest_sends.unique(userId, periodStart)`. Falls back to a deterministic template when AI is unavailable.
    -   **Big Rock Tasks**: Manages tasks for "Big Rocks" with status flow, assignee management, and bidirectional sync with Microsoft Planner.
    -   **MCP (Model Context Protocol) Server**: Standardized AI assistant integration with JWT auth, API key management, OAuth 2.0 authorization server (supporting Entra JWT validation and Vega OAuth), scope-based permissions, read/write tools for platform data, IP allowlisting, and rate limiting.
    -   **Galaxy Portal Trust & Read-Only API**: Galaxy customer portal can authenticate users into Vega via OAuth/JWT trust. New users are JIT-provisioned with the `portal_user` role, which is permission-restricted to a dedicated read-only `/api/portal/*` API surface (OKRs, check-ins, meetings) and excluded from authoring and admin paths. Trust validation, role provisioning, and tenant resolution are covered by the `galaxyPortal` test suite.
    -   **Combined-Context Dashboard Endpoint**: A single backend endpoint assembles dashboard payloads (objectives, key results, big rocks, pace/forecast, recent check-ins) for the Company OS, Executive, and Team dashboards, replacing the previous fan-out of 6+ requests per render.
    -   **Recursive CTE Hierarchy Loader**: Objective tree, key results, and big rocks are loaded via a single recursive CTE for millisecond-scale large-tenant queries; depth is capped with admin-tunable limits and warning emission for cycle/over-depth conditions.
    -   **Notifications, Search & Trash Backends**: Tenant-scoped in-app notification center (assignments, mentions, reminders, admin alerts with read/unread tracking), permission-aware global search across objectives/KRs/big rocks/meetings/people, and soft-delete + Trash storage with restore and 30-day automatic purge for all strategic items.
    -   **Search Index Strategy**: `searchAcrossEntities` runs tenant-scoped ILIKE `%query%` queries against title/description-equivalent columns on objectives, key_results, big_rocks, strategies, teams (name+description), meetings (title+summary), support_tickets (subject+description), and grounding_documents (title+description+content). To keep this fast on large tenants, the `pg_trgm` extension is enabled and 17 per-column GIN trigram indexes are created at server startup by `server/init.ts`. Replit's deployment migration analyzer strips the `gin_trgm_ops` operator class from any SQL it can statically read — including top-level DDL in `.sql` files, `DO $$ EXECUTE '…' $$` blocks, and raw `client.query()` template literals that contain the complete string — so the operator class is assembled at runtime via TypeScript array joining: `['gin', '_trgm', '_ops'].join('')`. The resulting SQL string never contains the complete literal `gin_trgm_ops` in source, making it invisible to static analysis. `migrations/0012_search_trgm_indexes.sql` only enables the `pg_trgm` extension; all 17 index `CREATE INDEX IF NOT EXISTS` calls (fully idempotent) are in `server/init.ts`. PostgreSQL automatically uses these GIN indexes to accelerate `ILIKE '%term%'` patterns, keeping search response times well under 200 ms even with thousands of records per table.
    -   **Live Meeting Mode Persistence**: Server-side persistence of live meeting state (agenda timer, decisions, risks, attendees) so reload or rejoin from another device resumes the meeting in place.
    -   **Bulk Reassignment**: Single-action backend transfer of every objective, key result, and big rock from one owner to another, with audit logging.
    -   **Check-in Draft Auto-Save**: Tenant-scoped server-side draft storage for in-flight check-ins, with auto-save, restore, conflict handling, and clear-on-submit.
    -   **Embeddable Cards**: Tenant admins issue per-entity (objective / key result / big rock / executive dashboard) tokens that drive a public, server-rendered card at `GET /embed/v1/:entityType/:token`. The route sets `Content-Security-Policy: frame-ancestors *` so URLs can be embedded in SharePoint, Galaxy portals, intranets, etc. Tokens are hashed at rest (SHA-256) with only a prefix shown in admin UI; supports `?theme=dark` and `?json=1`, auto-refreshes every 5 minutes, and writes per-hit access logs (status, IP, referer, duration). Admin CRUD lives at `/api/embed-tokens` and is gated by `adminOnly`. UI lives in TenantAdmin → Integrations.

## External Dependencies

-   **Microsoft 365 Integration**: Microsoft Graph Client for Excel, Outlook Calendar, and Microsoft Planner. Planner uses multi-tenant app-only client_credentials auth with per-tenant token caching. Outlook uses dual authentication paths (per-user Entra ID token or Replit connector token).
-   **AI Services**: Dynamic AI provider configuration supporting Replit AI (default), Azure OpenAI, OpenAI, and Anthropic. Admins can switch providers/models at runtime.
-   **UI Component Library**: shadcn/ui (built on Radix UI primitives).
-   **Database**: Neon PostgreSQL.
-   **Transactional Email**: SendGrid.
-   **HubSpot CRM Integration**: Automated deal creation for new tenant signups.
-   **OpenAPI Specification**: Full OpenAPI 3.0 spec at `/openapi.yaml` and `/openapi.json` for M365 Copilot Agent integration.
-   **M365 Copilot Agent**: Declarative agent manifest, API plugin manifest, and Teams app manifest available in `/public/copilot-agent/`.
-   **Galaxy Portal Integration**: Synozur's Galaxy customer portal can authenticate users into Vega via OAuth/JWT trust for read-only access to `/api/portal/*` endpoints. New users are JIT-provisioned with the `portal_user` role.