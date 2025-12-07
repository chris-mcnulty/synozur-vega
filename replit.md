# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application that functions as a comprehensive Company Operating System (Company OS). Its core mission is to align organizational strategy with execution through AI-powered modules that cover foundational elements, strategic planning, and focus rhythm management. The platform supports both consultant-led and self-service approaches, integrates with Microsoft 365, and maintains a consistent UI/UX with Orion.synozur.com for brand continuity. The overarching goal is to offer a holistic solution for companies to manage and effectively implement their strategic objectives.

## User Preferences
Preferred communication style: Simple, everyday language.

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
    - **Microsoft Entra ID SSO**: MSAL-based Azure AD authentication with PKCE flow, just-in-time user provisioning, and tenant mapping via `azureTenantId` or email domain.
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
- **AI Services**: GPT-5 integration via Replit AI Integrations (OpenAI-compatible API), supporting streaming chat, OKR suggestions, and Big Rock suggestions. AI context is enhanced via a Grounding Documents system.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector).