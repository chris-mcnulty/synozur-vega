# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application serving as a comprehensive Company Operating System (Company OS). Its purpose is to align organizational strategy with execution using AI-powered modules for foundational elements, strategic planning, and focus rhythm management. The platform supports consultant-led and self-service approaches, integrates with Microsoft 365, and maintains a consistent UI/UX with Orion.synozur.com for brand continuity, aiming to provide a holistic solution for managing and implementing strategic objectives.

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
    - **Planning Module**: Enhanced OKR system with hierarchical objectives, Key Results, and "big rocks."
    - **Focus Rhythm**: Full meeting management with OKR alignment, templates, auto-generated agendas, and search.
    - **Tenant Admin**: Manages organization, M365 integration status, tenant/user CRUD, and allowed email domains.
    - **Launchpad**: AI-powered document analysis for extracting and creating foundational company elements.
    - **OKR Cloning**: Allows cloning of objectives with various scope options and target quarter/year selection.
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
- **AI Services**: GPT-5 integration via Replit AI Integrations (OpenAI-compatible API) for streaming chat, OKR, and Big Rock suggestions. AI context is enhanced via a Grounding Documents system with support for tenant-specific "Background Context" documents that are automatically included in all AI conversations for that tenant. AI usage is tracked for provider/model switching and cost analysis.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector).
- **OpenAPI Specification**: Full OpenAPI 3.0 spec for M365 Copilot Agent integration available at `/openapi.yaml` (YAML) and `/openapi.json` (JSON). Documents all major endpoints: authentication, OKRs, strategies, foundations, meetings, teams, AI, and reporting.
- **M365 Copilot Agent**: Declarative agent manifest (v1.6), API plugin manifest, and Teams app manifest available in `/public/copilot-agent/`. Includes response formatting utilities in `server/copilot-response-formatter.ts`. See `public/copilot-agent/README.md` for deployment instructions.