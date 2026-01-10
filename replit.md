# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application serving as a comprehensive Company Operating System (Company OS). Its purpose is to align organizational strategy with execution using AI-powered modules for foundational elements, strategy development, and focus rhythm management. The platform supports consultant-led and self-service approaches, integrates with Microsoft 365, and maintains a consistent UI/UX with Orion.synozur.com for brand continuity, aiming to provide a holistic solution for managing and implementing strategic objectives.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, Wouter for routing, and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **UI/UX Decisions**: Mimics Orion.synozur.com's aesthetic, emphasizing whitespace, card-based layouts, and subtle animations.
- **Key Features**:
    - **Company OS Dashboard**: Real-time overview of Foundations, Strategies, Quarterly OKRs, Big Rocks, and upcoming meetings.
    - **Foundations Module**: Manages mission, vision, values, and annual goals with AI suggestions.
    - **Strategy Module**: Facilitates strategy management with AI drafting and goal alignment.
    - **Outcomes Module**: Enhanced OKR system with hierarchical objectives, Key Results, and "big rocks."
    - **Focus Rhythm**: Full meeting management with OKR alignment, templates, auto-generated agendas, and search.
    - **Tenant Admin**: Manages organization, M365 integration status, tenant/user CRUD, and allowed email domains.
    - **Launchpad**: AI-powered document analysis for extracting and creating foundational company elements.
    - **OKR Cloning**: Allows cloning of objectives with various scope options and target quarter/year selection.
    - **OKR Period Close-Out**: When checking in on objectives/KRs from a past period, prompts user to either continue working in a new period (opens clone dialog) or close with a mandatory closing note. Uses Pacific Time for period detection. Period-ended uses amber styling, target-exceeded uses green.
    - **Team Mode**: A simplified interface for teams, focusing on weekly execution, KRs, and Big Rocks relevant to the team.

### Backend
- **Server**: Express.js with Node.js, providing a RESTful API.
- **Data Storage**: PostgreSQL with Drizzle ORM, using UUIDs for primary keys.
- **System Design Choices**:
    - `IStorage` interface for CRUD operations, implemented by `DatabaseStorage`.
    - Session-based authentication with Express sessions, `connect-pg-simple`, bcryptjs for password hashing, and SendGrid for email verification.
    - **Microsoft Entra ID SSO**: Multi-tenant MSAL-based Azure AD authentication with PKCE flow, just-in-time user provisioning, and tenant mapping. Includes SSO policy enforcement and user-friendly error handling.
    - Multi-tenancy with data isolation per tenant, managed via `TenantContext` and `TenantSwitcher`.
    - Full RBAC enforcement with 6 defined roles: `tenant_user`, `tenant_admin`, `admin`, `global_admin`, `vega_consultant`, `vega_admin`.
    - **Fine-Grained OKR Permissions**: UPDATE_OWN_OKR vs UPDATE_ANY_OKR ownership checks. Server-side `canUserModifyOKR()` verifies ownerId, createdBy, or ownerEmail. Frontend `usePermissions()` hook with `canModifyOKR()` and `canModifyByEmail()` methods control Edit/Delete button visibility.
    - **Vocabulary Module**: Customizable terminology for core objects, with system-level defaults and tenant-level overrides.
    - **Public Domain Handling (Invite-Only Mode)**: Users signing up with public email domains (Gmail, Yahoo, Outlook, etc.) create personal invite-only tenants without claiming the public domain. This prevents domain squatting and ensures users from public domains can only join existing organizations via explicit invitation. Configurable in Tenant Admin via "Invite Only Mode" toggle.

### Development & Tools
- **Development Server**: Vite for client, esbuild for server, with HMR.
- **Type Safety**: TypeScript.
- **Form Management**: React Hook Form with Zod schemas.
- **Date Handling**: `date-fns`.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for integration with Excel, Outlook Calendar, and Microsoft Planner using OAuth.
    - **Planner Integration**: Full Microsoft Planner integration with per-user OAuth consent, supporting bidirectional sync of plans, buckets, and tasks, linkable to OKRs and Big Rocks. OAuth tokens are encrypted at rest.
    - **Outlook Calendar Integration**: Per-user OAuth consent flow for accessing Outlook Calendar events.
    - **Excel Data Binding**: Support for linking Key Results to OneDrive/SharePoint Excel files with cell reference binding.
- **AI Services**: GPT-5 integration via Replit AI Integrations (OpenAI-compatible API) for streaming chat, OKR, and Big Rock suggestions. AI context is enhanced via a Grounding Documents system:
    - **Grounding Document Categories**: INSTRUCTIONAL (methodology, best_practices, terminology, examples) - included in system prompt for inference mode to guide AI behavior. CONTEXTUAL (background_context, company_os) - included in user prompt as organizational context.
    - **Launchpad Modes**: Extraction mode (for structured OKR documents) uses verbatim extraction without instructional guidance. Inference mode (for narrative documents) uses instructional guidance to generate proposals.
    - AI usage is tracked for provider/model switching and cost analysis.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector).
- **OpenAPI Specification**: Full OpenAPI 3.0 spec for M365 Copilot Agent integration available at `/openapi.yaml` (YAML) and `/openapi.json` (JSON). Documents all major endpoints: authentication, OKRs, strategies, foundations, meetings, teams, AI, and reporting.
- **M365 Copilot Agent**: Declarative agent manifest (v1.6), API plugin manifest, and Teams app manifest available in `/public/copilot-agent/`. Includes response formatting utilities in `server/copilot-response-formatter.ts`. See `public/copilot-agent/README.md` for deployment instructions.

## Backlog & Feature Tracking

**BACKLOG.md** is the single source of truth for all feature proposals, implementation plans, UX enhancements, known issues, and technical decisions. All coding agents should reference BACKLOG.md for:
- Priority sequence and status of features
- UX enhancement proposals and implementation status
- Known issues and bugs
- Technical architecture decisions (ADRs)
- Completed features and their implementation notes

When adding new features or proposals, update BACKLOG.md rather than creating separate documentation files.

## Development Notes

### Azure App Registrations
- **Vega App ID**: `33479c45-f21f-4911-8189-0c7a53c6a9d7` (main Vega application - needs `User.Read.All` for Entra user search)
- **M365 Copilot Agent App ID**: `6aeac29a-cb76-405b-b0c6-df4a1a368f62` (declarative agent for Teams/Copilot)
- **M365 Enterprise Token Store Client**: `ab3be6b7-f5df-413d-ac2d-abf1e3fd9c0b`

### Important: Production vs Development Environments
- **Production database is separate**: Users login to production (vega.synozur.com) where SSO is configured. The development database has no information about production user accounts, tenants, or SSO configurations.
- **Cannot debug production auth issues from dev**: Production logs and database must be obtained separately to debug authentication issues.
- **Azure AD SSO is configured in production**: The Entra app registration points to production URLs.

### Microsoft 365 Connection Debugging
- Comprehensive logging added to `microsoftGraph.ts` with `[SharePoint]`, `[Graph]`, `[Connector]`, `[EntraApp]` prefixes.
- Connection check flow: 1) User delegated token → 2) Entra app credentials → 3) Connector fallback.
- Look for `========== checkSharePointConnection START ==========` in logs to trace connection issues.
- Error messages use proper capitalization: "SharePoint", "OneDrive", "Outlook".

### Key Implementation Patterns
- **Pacific Time Requirement**: All date/time operations use America/Los_Angeles timezone to prevent misdating
- **React Hooks Rule**: All hooks must be called unconditionally BEFORE any early returns or conditional rendering
- **Database Field Mapping**: Annual goals stored in `foundations.annualGoals` (not `goals`)
- **Brand Color**: #810FFB (used for announcement banner default background)
- **Mobile Design**: Gradient text only on desktop (md:), solid purple-400 on mobile

### Period Close-Out Logic
- Check `isPeriodEnded()` BEFORE `isTargetExceeded()`
- Period-ended uses amber styling, target-exceeded uses green
- Closing notes are mandatory when choosing not to continue in next period

### Mixed Child Rollup Progress Calculation
- Objectives in rollup mode calculate progress from BOTH Key Results AND child objectives
- Key Results always participate (using their weight, default 25% if unset)
- Child objectives only participate if they have a weight explicitly set (weight > 0)
- Child objectives with no weight (null) are excluded from parent rollup (backwards compatible)
- When editing a child objective, a weight slider appears to set its contribution to parent's progress
- Progress propagates upward: when a child's progress changes, parent is recalculated
- Helper function `calculateObjectiveRollupProgress()` in routes-okr.ts handles the calculation

### COS Import/Export
- Export and import routes use `x-tenant-id` header for tenant context (not user.tenantId or form body)
- Frontend must include `x-tenant-id` header when calling export/import APIs
- Export includes: foundations, strategies, objectives, key results, big rocks, teams, check-ins, grounding documents
- Import runs teams first so objectives can reference mapped team IDs
- Dashboard "Objectives by Team" groups organization-level objectives under "Organization" label with Globe icon