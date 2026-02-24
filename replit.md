# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application serving as a comprehensive Company Operating System (Company OS). Its core purpose is to align organizational strategy with execution using AI-powered modules for foundational elements, strategy development, and focus rhythm management. The platform supports both consultant-led and self-service models, integrates with Microsoft 365, and ensures brand continuity through a consistent UI/UX with Orion.synozur.com. It aims to deliver a holistic solution for strategic objective management and implementation, enhancing market potential through AI-driven insights and streamlined operations.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Wouter for routing, and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design, mimicking Orion.synozur.com's aesthetic with whitespace, card-based layouts, and subtle animations.
- **Key Features**:
    - **Dashboards**: Company OS, Executive (advanced analytics, velocity projections), and Team Dashboards (weekly execution focus).
    - **Core Modules**: Foundations (mission, vision, values, ambitions), Strategy (AI drafting, goal alignment), Outcomes (hierarchical OKRs, "big rocks", annual goals with AI suggestions), Focus Rhythm (meeting management), Reporting (PDF/PPTX export).
    - **Ambitions Module**: Manages 3-5 year strategic targets, linking vision to annual goals with AI suggestions and status tracking.
    - **AI & Intelligence**: OKR Intelligence for pace/velocity tracking, predictive projections, and "Behind Pace" alerts. **Predictive Analytics** with velocity-based completion forecasting, confidence bands (low/mid/high derived from check-in variance), trend detection (accelerating/steady/decelerating), risk flagging, and probability distribution visualization on the Executive Dashboard (`/api/okr/forecasts` endpoint, `calculateCompletionForecast()` in `server/okr-intelligence.ts`). Launchpad for AI-powered document analysis. AI-powered summary of recent platform updates via "What's New Modal".
    - **Administration**: Tenant Admin (org, M365 integration, user management), System Admin (platform-wide AI config, service plans).
    - **OKR Workflow**: Cloning, Period Close-Out with mandatory notes, Mixed Child Rollup Progress Calculation.
    - **Vocabulary Module**: Customizable terminology.
    - **Public Domain Handling**: Enforces invite-only tenants for public email domains to prevent squatting.
    - **Help Chatbot**: AI-powered assistant grounded on documentation, with support ticket escalation.
    - **Support Ticket System**: Manages user-submitted tickets with categories, priorities, statuses, and email notifications.

### Backend
- **Server**: Express.js with Node.js, providing a RESTful API.
- **Data Storage**: PostgreSQL with Drizzle ORM.
- **System Design Choices**:
    - `IStorage` interface for CRUD operations.
    - Session-based authentication with Express sessions, `connect-pg-simple`, bcryptjs, and SendGrid for email verification.
    - **Microsoft Entra ID SSO**: Multi-tenant MSAL-based Azure AD authentication with PKCE, JIT user provisioning, and tenant mapping.
    - Multi-tenancy with data isolation using `TenantContext` and `TenantSwitcher`.
    - Full RBAC enforcement with 6 defined roles (`tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`), including fine-grained OKR permissions.
    - All date/time operations use America/Los_Angeles timezone.
    - **Job Scheduler Service**: Central service for managing background jobs, including registration, logging, pause/resume, and failure notifications.
    - **Big Rock Tasks**: Manages tasks for "Big Rocks" with status flow, assignee management, and bidirectional sync with Microsoft Planner.
    - **MCP (Model Context Protocol) Server**: Standardized AI assistant integration for compatible AI tools, featuring JWT auth, API key management, OAuth 2.0 authorization server, scope-based permissions, read/write tools for platform data, IP allowlisting, and rate limiting. OAuth 2.0 endpoints at `/oauth/authorize`, `/oauth/token`, and `/oauth/.well-known/openid-configuration` enable M365 Copilot deployment with per-user authentication via Authorization Code + PKCE flow. OAuth clients managed via `/api/oauth/clients` (admin only). Schema: `oauth_clients`, `oauth_authorization_codes`, `oauth_refresh_tokens` tables.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for integration with Excel, Outlook Calendar, and Microsoft Planner. Planner uses **multi-tenant app-only client_credentials auth** via `server/services/planner-auth.ts` with per-tenant token caching. Uses the shared `AZURE_CLIENT_ID` and `AZURE_CLIENT_SECRET` env vars (one multi-tenant app registration); the Azure tenant ID comes from each Vega tenant's `azureTenantId` field in the database (not from an env var). All graph-planner.ts functions accept `azureTenantId` to target the correct tenant's token endpoint. Supports bidirectional sync for Planner tasks, event access for Outlook (per-user OAuth), and Excel data binding for Key Results. Constellation-style Planner integration with multi-step wizard dialog for plan creation (Team → Channel → Plan flow). **Dual Outlook auth**: All M365 calendar routes use `*ForUser()` functions in `microsoftGraph.ts` that try the per-user Entra ID token first (from `graph_tokens` table), falling back to the Replit connector token. This ensures production users connected via Entra SSO are recognized.
- **AI Services**: Dynamic AI provider configuration supporting Replit AI (default), Azure OpenAI, OpenAI, and Anthropic. Admins can switch providers/models (e.g., GPT-5, GPT-4o, Claude Opus 4.5) at runtime. Includes grounding documents, AI usage tracking, and a Model Comparison dashboard.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid.
- **HubSpot CRM Integration**: Automated deal creation for new tenant signups.
- **OpenAPI Specification**: Full OpenAPI 3.0 spec at `/openapi.yaml` and `/openapi.json` for M365 Copilot Agent integration.
- **M365 Copilot Agent**: Declarative agent manifest, API plugin manifest, and Teams app manifest available in `/public/copilot-agent/`.

## Planning & Tracking

- **BACKLOG.md**: The master backlog document (2,800+ lines) containing all feature proposals, implementation plans, UX enhancements, known issues, technical decisions, business vision, and completed features. This is the single source of truth for all backlog-related questions. Located at project root.
- **Roadmap Page** (`/roadmap`): Public-facing view of committed deliverables — what's been completed, what's in progress, and what's committed next. Data defined in `client/src/pages/Roadmap.tsx`.
- **Backlog Page** (`/backlog`): Comprehensive in-app view of everything in the backlog — proposed features, design work, known issues, future vision, and completed items. Filterable by status and category. Data defined in `client/src/pages/Backlog.tsx`.
- **Changelog Page** (`/changelog`): Version-by-version release notes.
- **About Page** (`/about`): Links to all three (Changelog, Roadmap, Backlog) in the "Updates, Roadmap & Backlog" section.
- **Key distinction**: Roadmap = committed work. Backlog = everything proposed or suggested. When features move from backlog to active development, update both pages.

## Related Projects

- **Photo Pairs App**: https://github.com/chris-mcnulty/Cascadia-photo-pairs (Replit: https://replit.com/@chrismcnulty/Photo-Pairs) — Christopher McNulty's photo voting/pairing application built on Replit. Referenced for UX patterns including alert banner design.

## Announcement Banner System

- **Schema**: `system_banners` table in `shared/schema.ts` — supports `off`/`on`/`scheduled` status, `scheduledStart`/`scheduledEnd` for time-bound display, custom `backgroundColor`/`textColor`, optional link with `linkUrl`/`linkText`.
- **Display**: `AnnouncementBanner` component rendered globally in `ModuleLayout` (App.tsx) above the header for all authenticated pages. Not shown on the public Landing page.
- **Dismissal**: Uses `sessionStorage` keyed by banner ID. Once dismissed, stays hidden for the rest of the browser session. A new banner with a different ID will show fresh.
- **Admin**: Managed by platform admins (Vega Admins) in the System Admin panel under "System Announcements". Supports creating multiple banners, scheduling with date/time pickers, color presets, and live preview.
- **API**: `GET /api/banners/active` returns the currently active banner (respects scheduling logic). CRUD via `/api/admin/banners` (platform admin only).