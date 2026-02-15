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
    - **MCP (Model Context Protocol) Server**: Standardized AI assistant integration for compatible AI tools, featuring JWT auth, API key management, scope-based permissions, read/write tools for platform data, IP allowlisting, and rate limiting.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for integration with Excel, Outlook Calendar, and Microsoft Planner. Planner uses **app-only client_credentials auth** (no per-user tokens) via `server/services/planner-auth.ts` with self-managing token cache. Requires env vars: `PLANNER_TENANT_ID`, `PLANNER_CLIENT_ID`, `PLANNER_CLIENT_SECRET` (falls back to `AZURE_*` prefixed vars). Supports bidirectional sync for Planner tasks, event access for Outlook (per-user OAuth), and Excel data binding for Key Results. Constellation-style Planner integration with multi-step wizard dialog for plan creation (Team → Channel → Plan flow).
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