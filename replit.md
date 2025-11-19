# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application designed as a comprehensive Company Operating System (Company OS). It aims to align organizational strategy with execution through AI-powered modules covering foundations, strategy, planning, and focus rhythm management. The platform integrates with Microsoft 365 services and supports both consultant-led and self-service workflows, mirroring the UI/UX of Orion.synozur.com for brand consistency.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes (November 2025)
- **Key Result Check-Ins with Value Input**: Implemented unit-based value input for KR check-ins
  - Check-in dialog shows value input field with KR-specific unit (e.g., "24 blog posts")
  - Progress auto-calculates based on metric type (increase/decrease/maintain/complete)
  - Draft state pattern allows safe editing with real-time validation feedback
  - Submit button disabled until valid number entered
  - Robust edge case handling (division by zero, NaN, undefined legacy values)
- **Login Screen Tab Order**: Changed default tab and order to Login → Sign Up → Demo (was Demo → Login → Sign Up)
- **Dashboard Resilience**: Implemented per-section error handling - each module (Foundations, Strategies, OKRs, Big Rocks, Meetings) fails independently with helpful error messages instead of breaking the entire dashboard
- **Schema Cleanup**: Removed deprecated `rocks` table; consolidated to `big_rocks` only for cleaner architecture
- **Foundation Display**: Fixed foundation data rendering issues in production by improving error handling
- **Dashboard Date Selector**: Now defaults to current quarter based on today's date (calculated dynamically)
- **Annual OKR Filtering**: OKRs for a period now include both quarter-specific OKRs AND annual OKRs (quarter=0) for that year's fiscal period
  - **Applies everywhere**: Dashboard, Planning module, and all API endpoints that query objectives or big rocks
  - **Backend implementation**: Filtering logic in `storage.ts` automatically includes annual items (quarter=0) when filtering by quarter/year
  - **Example**: Viewing Q4 2025 returns both Q4-specific objectives AND annual 2025 objectives

## System Architecture

### Frontend
- **Framework**: React with TypeScript, using Wouter for routing and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS with a custom configuration, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **Design Principles**: Orion.synozur.com aesthetic, generous whitespace, card-based layouts, and subtle animations.
- **Modules**:
    - **Company OS Dashboard**: Real-time overview displaying:
        - Foundations (mission, vision, values, annual goals)
        - Strategic priorities with status tracking
        - Quarterly OKRs and Big Rocks
        - Upcoming meetings
        - All data fetched from live database (no mock data)
        - **Error Handling**: Per-section errors with helpful messages; one failed section doesn't break the entire dashboard
    - **Foundations**: CRUD for mission, vision, values, and annual goals with AI suggestions.
    - **Strategy**: Strategic priorities with AI drafting capabilities and goal alignment.
        - **Alignment**: Strategies can link to multiple annual goals (optional many-to-many relationship).
    - **Planning**: Enhanced OKR system with hierarchical objectives, Key Results with weighted rollup progress tracking, and "big rocks" (initiatives).
        - **Key Result Features**: Metric type selector (increase/decrease/maintain/complete), progress visualization, and KPI promotion.
        - **UI Enhancements**: Quick-add buttons for Key Results, count badges showing KR/Big Rock counts on collapsed objectives.
        - **Weighted Rollup**: Key Result progress × weight aggregates to parent objective progress.
        - **Weight Management**: Interactive dialog for managing Key Result weights with lock/unlock functionality, auto-balance, and normalization.
        - **Big Rock Alignment**: Big Rocks can link to multiple strategies (optional many-to-many relationship via `linkedStrategies` field).
    - **Focus Rhythm**: Meeting management and summaries.
    - **Tenant Admin**: Organization management, M365 service integration status, tenant CRUD, user CRUD, and allowed email domain management.

### Backend
- **Server**: Express.js with Node.js, RESTful API (prefixed with `/api`).
    - **Production Configuration**: Trust proxy setting enabled for secure session cookies behind reverse proxy.
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

## Future Features / Backlog

### Company OS Export/Import System
- **Purpose**: Enable export and import of complete Company OS data for a given company and year
- **Use Case**: Data portability between companies or servers, backups, migrations, testing
- **Scope**:
  - Export to JSON file with `.cos` extension
  - Include all related data: foundations, strategies, OKRs, Key Results, Big Rocks, meetings
  - Tenant-specific and year-specific filtering
  - Import capability to different tenant or server
  - Data validation and conflict resolution during import

### Snapshot System for Company OS
- **Purpose**: Capture point-in-time snapshots of Big Rocks and OKRs for documentation rhythm
- **Use Case**: Historical tracking and reporting, especially for board meetings, quarterly reviews, and audit trails
- **Scope**: 
  - As-of date snapshots for Objectives, Key Results, and Big Rocks
  - Snapshot metadata (created date, quarter, year, created by)
  - Read-only views of historical snapshots
  - Comparison views between snapshots