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
    - **Core Modules**: Foundations (mission, vision, values, ambitions), Strategy (AI drafting, goal alignment), Outcomes (hierarchical OKRs, "big rocks", annual goals with AI suggestions and ambition linking), Focus Rhythm (meeting management), Reporting (PDF/PPTX export, customizable branding).
    - **Ambitions Module**: Long-term strategic targets (3-5 years) bridging vision and annual goals. Features: add/edit/close/reopen, value linking, target year selection, active/closed filtering, soft limit warning at >5 active. Annual Goals can optionally link to parent Ambitions.
    - **AI & Intelligence**: OKR Intelligence for pace and velocity tracking, predictive projections, and "Behind Pace" alerts. Launchpad for AI-powered document analysis.
    - **Administration**: Tenant Admin (org, M365 integration, user management, allowed domains), System Admin (platform-wide AI config, service plans, announcements).
    - **OKR Workflow**: Cloning, Period Close-Out with mandatory notes, Mixed Child Rollup Progress Calculation.
    - **Vocabulary Module**: Customizable terminology with system defaults and tenant overrides.
    - **Public Domain Handling (Invite-Only Mode)**: Prevents domain squatting for public email domains by enforcing invite-only tenants.
    - **What's New Modal**: AI-powered summary of recent platform updates shown on login. Dismissible per-version, tenant-level toggle. Uses CHANGELOG.md as source.
    - **Changelog Page**: Full markdown-rendered changelog at `/changelog` with search, table of contents, and scroll-to-top. Accessible from sidebar navigation.

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
    - **Job Scheduler Service**: Central service for managing background jobs with registration, execution logging, pause/resume functionality, and failure email notifications to vega_admin users.

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
    - 10 read-only tools for accessing OKRs, Big Rocks, Strategies, Mission, Vision, Values, Annual Goals, Ambitions, Teams, and Meetings
    - 3 write tools: `update_kr_progress`, `add_check_in_note`, `update_big_rock_status`
    - IP allowlisting with CIDR notation support
    - Key rotation with configurable grace periods
    - Rate limiting (60 req/min per tenant, 10 token exchanges/min per IP)
    - Full audit logging of all tool invocations
    - UI for key management in Tenant Admin → Integrations tab with IP restrictions, rotation, and visual warning for write permissions
- **Microsoft Planner Integration (Priority 1)**: Bidirectional task linking between Planner and Vega. Features:
    - PlannerTaskLinkPanel in Objective and Big Rock detail views for linking/unlinking tasks
    - PlannerSyncStatusSection in Tenant Admin → Integrations tab with connection status, sync metrics, manual sync controls
    - Independent OAuth flow with Tasks.ReadWrite + Group.Read.All scopes (no Outlook dependency)
    - Token expiry detection with reconnect banners and error recovery
    - Auto-sync scheduler job (planner-sync) running every 4 hours via Job Scheduler
    - Backend: graph-planner service (server/services/graph-planner.ts), planner routes (server/routes-planner.ts)
    - Frontend: PlannerTaskLinkPanel (client/src/components/planner/PlannerTaskLinkPanel.tsx)
- **Job Scheduler**: Platform-wide background job management accessible via System Admin → Scheduled Jobs. Features job registration, execution history, manual triggers, pause/resume controls, schedule editing (vega_admin only), kill stuck runs (with confirmation), and failure email notifications. Currently runs 3 system jobs: expiration-reminders (daily), reminder-cache-reset (daily), planner-sync (every 4 hours). Supports schedule presets from every minute to daily intervals. Kill functionality marks stuck runs as KILLED and records killedByUserId and killedAt. Aligned with Constellation patterns including resultSummary JSONB field for structured execution results.

## Related Synozur Products

### Constellation (Synozur Consulting Delivery Platform - SCDP)
- **Repository**: https://github.com/chris-mcnulty/synozur-scdp
- **Purpose**: Comprehensive platform managing the entire lifecycle of consulting projects - estimation, resource allocation, time tracking, expense management, and automated invoice generation.
- **Relevant Patterns for Vega**:
    - **Microsoft Planner Integration**: Full bidirectional sync with Planner tasks, uses app-only auth with client credentials flow
    - **Team/Channel Creation Pattern**: Uses Microsoft Graph API for:
        - `createTeam()`: Creates Teams from templates or standard, supports async 202 response handling with polling
        - `createChannel()`: Creates channels with standard/private/shared membership types
        - `createPlannerTab()`: Pins Planner tabs to channels using the `com.microsoft.teamspace.tab.planner` app ID
        - `addTeamMember()`: Adds members with owner/member roles
    - **Graph Client Setup**: Uses `@microsoft/microsoft-graph-client` with client credentials token cached with expiry
    - **Azure App Permissions Required**: Team.Create, Group.Create, Channel.Create, TeamsTab.Create, Tasks.ReadWrite, Group.Read.All
    - **Multi-tenant Pattern**: UUID-based tenant IDs, tenant-scoped data isolation, same pattern as Vega
- **Reference**: Use Constellation's `server/services/planner-service.ts` and `planner-graph-client.ts` as patterns for implementing Big Rock → Planner sync in Vega

## Big Rock Tasks Feature (Implemented)

### Data Model
- `bigRockTasks` table: id, bigRockId, title, description, status (open, in_progress, completed), assigneeId, assigneeEmail, dueDate, sortOrder, plannerTaskId, createdAt, completedAt

### Status Flow
- Open → In Progress → Completed (cycles back to Open)
- Status mapping for future Planner sync: Open=0%, In Progress=50%, Completed=100%
- completedAt timestamp automatically set when status changes to completed

### RBAC Permissions
- Big Rock owners can add/delete tasks and update any task
- Task assignees (by email) can update their own tasks
- Status toggle is disabled for non-owners/non-assignees

### API Routes
- GET `/api/okr/big-rocks/:bigRockId/tasks` - List tasks for a Big Rock
- POST `/api/okr/big-rocks/:bigRockId/tasks` - Create task (owner only)
- PATCH `/api/okr/big-rocks/:bigRockId/tasks/:taskId` - Update task (owner or assignee)
- DELETE `/api/okr/big-rocks/:bigRockId/tasks/:taskId` - Delete task (owner only)
- POST `/api/okr/big-rocks/task-counts` - Get task counts for multiple Big Rocks

### UI Components
- `BigRockTasks` component in `client/src/components/okr/BigRockTasks.tsx`
- Integrated into Big Rock edit dialog in `PlanningEnhanced.tsx`
- Task count badges (completed/total) displayed on Big Rock cards

