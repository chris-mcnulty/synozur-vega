# Vega - AI-Augmented Company OS Platform

## Overview
Vega is a responsive web application serving as a comprehensive Company Operating System (Company OS). Its primary purpose is to synchronize organizational strategy with execution through AI-powered modules covering foundational elements, strategic planning, and focus rhythm management. The platform is designed for both consultant-led and self-service workflows, integrates with Microsoft 365, and maintains a consistent UI/UX with Orion.synozur.com for brand alignment. The ambition is to provide a holistic platform for companies to manage and execute their strategic objectives effectively.

## User Preferences
Preferred communication style: Simple, everyday language.

## Project Documentation

For detailed information, see:
- **[BACKLOG.md](./BACKLOG.md)** - Feature backlog organized by priority (HIGH/MEDIUM/LOW)
- **[KNOWN_ISSUES.md](./KNOWN_ISSUES.md)** - Current bugs, issues, and technical debt
- **[TECHNICAL_DECISIONS.md](./TECHNICAL_DECISIONS.md)** - Architecture Decision Records (ADRs)

## Recent Changes (November 2025)

- ✅ **Entity Relationship Linking**: Objectives link to strategies/goals, Big Rocks link to strategies
- ✅ **Culture & Values Integration**: Value tagging for Objectives and Strategies (NOT Big Rocks - removed to reduce data clutter)
- ✅ **Foreign Key Constraint Fix**: Empty strings converted to null in update endpoints
- ✅ **Enhanced Documentation**: Created BACKLOG.md, KNOWN_ISSUES.md, TECHNICAL_DECISIONS.md
- 🚧 **In Progress**: Big Rock linkedStrategies state management bug (see KNOWN_ISSUES.md)

## System Architecture

### Frontend
- **Framework**: React with TypeScript, utilizing Wouter for routing and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS with custom configuration, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **UI/UX Decisions**: Mimics Orion.synozur.com's aesthetic, emphasizing generous whitespace, card-based layouts, and subtle animations.
- **Technical Implementations & Feature Specifications**:
    - **Company OS Dashboard**: Provides a real-time overview of Foundations (mission, vision, values, annual goals), Strategic priorities, Quarterly OKRs, Big Rocks, and upcoming meetings, with per-section error handling.
    - **Foundations Module**: Manages mission, vision, values, and annual goals, incorporating AI suggestions. Values include both title and description.
    - **Strategy Module**: Facilitates strategic priority management with AI drafting and goal alignment (many-to-many relationship with annual goals).
    - **Planning Module**: Implements an enhanced OKR system with hierarchical objectives, Key Results, and "big rocks" (initiatives).
        - **Key Result Features**: Metric type selection (increase/decrease/maintain/complete), unit-based value input, progress visualization, KPI promotion, and check-in history.
        - **Weighted Rollup**: Key Result progress, weighted, aggregates to parent objective progress.
        - **Big Rock Alignment**: Big Rocks can link to multiple strategies (many-to-many relationship).
    - **Focus Rhythm**: Manages meetings and summaries.
    - **Tenant Admin**: For organization management, M365 integration status, tenant/user CRUD, and allowed email domain management.

### Backend
- **Server**: Express.js with Node.js, providing a RESTful API (`/api` prefix).
- **Data Storage**: PostgreSQL with Drizzle ORM, using UUIDs for primary keys and foreign key relationships for tenant-scoped data.
- **System Design Choices**:
    - `IStorage` interface for CRUD operations, implemented by `DatabaseStorage`.
    - Session-based authentication using Express sessions and `connect-pg-simple`, secure password hashing (bcryptjs), and a robust email verification system with SendGrid integration.
    - Multi-tenancy with data isolation per tenant, managed via `TenantContext` and `TenantSwitcher`, supporting tenant-specific branding and email domains.
    - User roles (tenant_user, tenant_admin, admin, global_admin, vega_consultant, vega_admin) are defined, with RBAC enforcement as a future feature.

### Development & Tools
- **Development Server**: Vite for client, esbuild for server, with HMR.
- **Type Safety**: TypeScript.
- **Form Management**: React Hook Form with Zod schemas for validation.
- **Date Handling**: `date-fns`.

## External Dependencies

- **Microsoft 365 Integration**: Microsoft Graph Client for planned integrations with Excel, Outlook Calendar, and Microsoft Planner, utilizing OAuth for authentication.
- **AI Services**: Placeholder for future GPT-based API integration.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector) for email verification and password reset.