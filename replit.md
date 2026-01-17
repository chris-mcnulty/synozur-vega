# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application designed as a comprehensive Company Operating System (Company OS). Its primary goal is to synchronize organizational strategy with execution through AI-powered modules that manage foundational elements, strategy development, and focus rhythm. The platform supports both consultant-led and self-service models, integrates with Microsoft 365, and maintains a consistent UI/UX with Orion.synozur.com for brand continuity. It aims to provide a holistic solution for managing and implementing strategic objectives.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Wouter for routing, and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **UI/UX Decisions**: Mimics Orion.synozur.com's aesthetic, emphasizing whitespace, card-based layouts, and subtle animations.
- **Key Features**:
    - **Dashboards**: Company OS Dashboard, Executive Dashboard (advanced analytics, pace tracking, velocity projections), and Team Dashboard (simplified, weekly execution focus).
    - **Core Modules**: Foundations (mission, vision, values, annual goals with AI), Strategy (AI drafting, goal alignment), Outcomes (hierarchical OKRs, "big rocks"), Focus Rhythm (meeting management), Reporting (PDF/PPTX export, customizable branding).
    - **AI & Intelligence**: OKR Intelligence for pace and velocity tracking, predictive projections, and "Behind Pace" alerts. Launchpad for AI-powered document analysis.
    - **Administration**: Tenant Admin (org, M365 integration, user management, allowed domains), System Admin (platform-wide AI config, service plans, announcements).
    - **OKR Workflow**: Cloning, Period Close-Out with mandatory notes, Mixed Child Rollup Progress Calculation.
    - **Vocabulary Module**: Customizable terminology with system defaults and tenant overrides.
    - **Public Domain Handling (Invite-Only Mode)**: Prevents domain squatting for public email domains by enforcing invite-only tenants.

### Backend
- **Server**: Express.js with Node.js, providing a RESTful API.
- **Data Storage**: PostgreSQL with Drizzle ORM, using UUIDs.
- **System Design Choices**:
    - `IStorage` interface for CRUD operations.
    - Session-based authentication with Express sessions, `connect-pg-simple`, bcryptjs, and SendGrid for email verification.
    - **Microsoft Entra ID SSO**: Multi-tenant MSAL-based Azure AD authentication with PKCE, JIT user provisioning, and tenant mapping.
    - Multi-tenancy with data isolation using `TenantContext` and `TenantSwitcher`.
    - Full RBAC enforcement with 6 defined roles (`tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`).
    - Fine-grained OKR permissions (UPDATE_OWN_OKR vs UPDATE_ANY_OKR) with server-side checks and frontend `usePermissions()` hook.
    - All date/time operations use America/Los_Angeles timezone.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for integration with Excel, Outlook Calendar, and Microsoft Planner via OAuth. Supports bidirectional sync for Planner, event access for Outlook, and Excel data binding for Key Results.
- **AI Services**: Dynamic AI provider configuration supporting Replit AI (default), Azure OpenAI, OpenAI, and Anthropic. Admins can switch providers/models (GPT-5, GPT-4o, Claude 3.5 Opus/Sonnet/Haiku) at runtime. Includes grounding documents for AI behavior and context, and tracks AI usage for cost analysis.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid.
- **HubSpot CRM Integration**: Automated deal creation for new tenant signups.
- **OpenAPI Specification**: Full OpenAPI 3.0 spec available at `/openapi.yaml` and `/openapi.json` for M365 Copilot Agent integration.
- **M365 Copilot Agent**: Declarative agent manifest, API plugin manifest, and Teams app manifest available in `/public/copilot-agent/`.
- **MCP (Model Context Protocol) Server**: Standardized AI assistant integration at `/mcp` endpoint. Supports Claude Desktop, Cursor, and other MCP-compatible AI tools. Features:
    - JWT-based authentication with 1-hour token expiry
    - API key management via `/api/mcp/keys` with bcrypt hashing
    - Scope-based permissions: `read:okrs`, `write:okrs`, `read:big_rocks`, `write:big_rocks`, `read:strategies`, `read:foundations`, `read:teams`, `read:meetings`
    - 9 read-only tools for accessing OKRs, Big Rocks, Strategies, Mission, Vision, Values, Annual Goals, Teams, and Meetings
    - 3 write tools: `update_kr_progress`, `add_check_in_note`, `update_big_rock_status`
    - IP allowlisting with CIDR notation support
    - Key rotation with configurable grace periods
    - Rate limiting (60 req/min per tenant, 10 token exchanges/min per IP)
    - Full audit logging of all tool invocations
    - UI for key management in Tenant Admin → Integrations tab with IP restrictions, rotation, and visual warning for write permissions