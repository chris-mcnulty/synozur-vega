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
    -   **Dashboards**: Company OS, Executive (analytics, projections), and Team Dashboards (weekly focus), all loading via a single, optimized API endpoint.
    -   **Core Modules**: Foundations (mission, vision, values, ambitions), Strategy (AI drafting, goal alignment), Outcomes (hierarchical OKRs, "big rocks", annual goals with AI suggestions), Focus Rhythm (meeting management with Live Meeting Mode, timers, quick-capture, and persistence), Reporting (PDF/PPTX export).
    -   **Ambitions Module**: Manages 3-5 year strategic targets, linking vision to annual goals with AI suggestions and status tracking.
    -   **AI & Intelligence**: OKR Intelligence for pace/velocity tracking, predictive analytics with completion forecasting, confidence bands, trend detection, risk flagging, and probability distribution visualization. AI-powered document analysis and "What's New" modal.
    -   **Administration**: Tenant Admin (org, M365 integration, user management) and System Admin (platform-wide AI config, service plans).
    -   **OKR Workflow**: Cloning, Period Close-Out, Mixed Child Rollup Progress Calculation.
    -   **Soft Delete & Trash/Recovery**: Strategic items are soft-deleted with a 30-day purge cycle, accessible via an admin-only trash page.
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
    -   Full RBAC enforcement with 6 defined roles and fine-grained OKR permissions.
    -   All date/time operations use America/Los_Angeles timezone.
    -   **Job Scheduler Service**: Manages background jobs, including registration, logging, pause/resume, and failure notifications.
    -   **Big Rock Tasks**: Manages tasks for "Big Rocks" with status flow, assignee management, and bidirectional sync with Microsoft Planner.
    -   **MCP (Model Context Protocol) Server**: Standardized AI assistant integration with JWT auth, API key management, OAuth 2.0 authorization server (supporting Entra JWT validation and Vega OAuth), scope-based permissions, read/write tools for platform data, IP allowlisting, and rate limiting.

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