# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application designed as a comprehensive Company Operating System (Company OS). It aims to align organizational strategy with execution through AI-powered modules covering foundations, strategy, planning, and focus rhythm management. The platform integrates with Microsoft 365 services and supports both consultant-led and self-service workflows, mirroring the UI/UX of Orion.synozur.com for brand consistency.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Wouter for routing and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS with a custom configuration, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **Design Principles**: Orion.synozur.com aesthetic, generous whitespace, card-based layouts, and subtle animations.
- **Modules**:
    - **Foundations**: CRUD for mission, vision, values, and annual goals with AI suggestions.
    - **Strategy**: Strategic priorities with AI drafting capabilities.
    - **Planning**: OKRs, KPIs, and "big rocks" (initiatives), including null handling for parent/objective/key result IDs.
    - **Focus Rhythm**: Meeting management and summaries.
    - **Tenant Admin**: Organization management, M365 service integration status, tenant CRUD, user CRUD, and allowed email domain management.

### Backend
- **Server**: Express.js with Node.js, RESTful API (prefixed with `/api`).
- **Data Storage**: PostgreSQL with Drizzle ORM, UUID-based primary keys, and foreign key relationships for tenant-scoped data.
- **API Design**: `IStorage` interface for CRUD operations, implemented by `DatabaseStorage` for PostgreSQL.
- **Authentication**: Session-based authentication using Express sessions and `connect-pg-simple`.
    - Secure password hashing with bcryptjs.
    - **Email Verification System**: New users must verify email before login access is granted.
        - Verification tokens generated with crypto.randomBytes and hashed using SHA-256 before database storage.
        - Reset tokens follow same secure pattern (plaintext sent via email, hash stored in database).
        - Tokens expire after 24 hours for security.
        - Email templates use professional HTML formatting with Vega branding.
        - SendGrid integration via Replit connector (no hardcoded API keys).
    - Global admin and consultant users are automatically initialized and pre-verified.
- **Authorization**: Supports 6 user roles (tenant_user, tenant_admin, admin, global_admin, vega_consultant, vega_admin) with flexible tenant assignment, though RBAC enforcement is a future feature.
- **Multi-Tenancy**: Data isolation per tenant, managed via `TenantContext` and `TenantSwitcher` component. Tenant-specific branding (color) and email domain management. Authentication persistence across navigation.

### Development & Tools
- **Development Server**: Vite for client, esbuild for server, with HMR and Replit-specific plugins.
- **Type Safety**: TypeScript used throughout.
- **Form Management**: React Hook Form with Zod schemas for validation.
- **Date Handling**: `date-fns` for date manipulation.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for planned integrations with Excel, Outlook Calendar, and Microsoft Planner; OAuth for authentication.
- **AI Services**: Placeholder for future GPT-based API integration for drafting, summaries, and guidance.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives) for accessible and customizable components.
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector) for email verification and password reset.