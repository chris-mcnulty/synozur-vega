# Vega - AI-Augmented Company OS Platform

## Overview

Vega is a responsive web application that delivers a comprehensive Company Operating System (Company OS) experience. The platform helps organizations align strategy with execution through AI-powered modules for foundations, strategy, planning, and focus rhythm management. Built with modern web technologies, Vega integrates seamlessly with Microsoft 365 services and provides both consultant-led and self-service workflows.

The application is designed to mirror the aesthetic and UX patterns of Orion.synozur.com, creating brand continuity between platforms while delivering powerful organizational management capabilities.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript
- Single Page Application (SPA) using Wouter for client-side routing
- Component-based architecture with reusable UI components from shadcn/ui (Radix UI primitives)
- State management through React hooks and TanStack Query for server state
- Theme support with light/dark mode toggle via ThemeProvider context (defaults to dark mode)

**Styling Approach**:
- TailwindCSS with custom configuration for consistent design system
- Custom font: Avenir Next LT Pro with multiple weights (400, 500, 600, 700)
- Design tokens using CSS variables for colors and spacing
- Custom utility classes for elevation effects (hover-elevate, active-elevate-2)
- Responsive design with mobile-first breakpoints

**Key Design Principles**:
- Reference-based design mirroring Orion.synozur.com aesthetic
- Generous whitespace and minimal clutter
- Subtle animations and transitions
- Consistent spacing scale using Tailwind units
- Card-based layouts with subtle shadows and rounded corners

**Module Structure**:
- Landing page with hero section and feature showcase
- Dashboard with quarter-based views and progress tracking
- Foundations module for mission, vision, values, and annual goals with full CRUD capabilities
  - Master View: Read-only display of current tenant's foundation elements
  - Edit Sections: Interactive editing interface with custom input fields
  - Quick Suggestions: Pre-populated suggestion badges for rapid selection
  - Custom Elements: Input fields for creating custom mission/vision/values/goals
  - Delete Functionality: Individual element removal and clear all option
  - Database Persistence: All changes saved to PostgreSQL and persist across sessions
- Strategy module for strategic priorities with AI drafting
- Planning module for OKRs, KPIs, and quarterly rocks (initiatives called "big rocks")
  - **Bug Fix** (November 2025): Empty FK values (parentId, objectiveId, keyResultId) now properly converted to null before database insertion, preventing FK constraint violations
  - Objectives and big rocks can now be created successfully with proper null handling
- Focus Rhythm module for meeting management and summaries
- Tenant Admin for organization management and M365 service integration
  - Organizations Section: Complete tenant CRUD with dialogs for create/edit
  - M365 Service Connections: Mock integration status for Excel, Outlook, Planner
  - Visual tenant cards with avatar, name, and action buttons

### Backend Architecture

**Server Framework**: Express.js with Node.js
- RESTful API architecture (routes prefixed with `/api`)
- Middleware for JSON parsing and request logging
- In-memory storage implementation with interface for future database migration
- Session management preparation with connect-pg-simple

**Development Setup**:
- Vite for fast development server with HMR (Hot Module Replacement)
- TypeScript compilation with strict mode enabled
- Custom Vite plugins for Replit integration (error overlay, cartographer, dev banner)
- Separate build processes for client (Vite) and server (esbuild)

**API Design Pattern**:
- Storage interface (IStorage) defines CRUD operations for all entities
- DatabaseStorage implementation for PostgreSQL persistence
- RESTful endpoints for all resources (users, tenants, foundations, strategies, OKRs, KPIs, rocks, meetings)
- Tenant endpoints: GET /api/tenants, POST /api/tenants, PATCH /api/tenants/:id, DELETE /api/tenants/:id
- UUID-based primary keys for all entities
- Request validation using Zod schemas from drizzle-zod

### Data Storage Solutions

**Current State**: PostgreSQL database with persistent storage (production-ready)
- Neon PostgreSQL database connected and configured
- Comprehensive schema with 8 tables: users, tenants, foundations, strategies, okrs, kpis, rocks, meetings
- All tables use UUID-based primary keys with proper unique constraints
- Foreign key relationships configured for tenant-scoped data integrity
- Demo data seeded for Acme Corporation and The Synozur Alliance LLC
- Database storage layer (DatabaseStorage) implemented in server/storage.ts
- Password hashing implemented using bcryptjs (10 salt rounds)
- Idempotent seed script - can be run multiple times safely

**Database Implementation**: 
- Drizzle ORM configured for PostgreSQL with Neon serverless driver
- Schema definition in shared/schema.ts with compound unique constraints:
  - tenants.name: UNIQUE (prevents duplicate tenant names)
  - foundations.tenant_id: UNIQUE (one foundation per tenant)
  - strategies: UNIQUE(tenant_id, title)
  - okrs: UNIQUE(tenant_id, objective, quarter, year)
  - kpis: UNIQUE(tenant_id, label, quarter, year)
  - rocks: UNIQUE(tenant_id, title, quarter, year)
  - meetings: UNIQUE(tenant_id, title, date)
- Migration executed via `npm run db:push` (use --force if needed)
- Seed script (server/seed.ts) populates demo data with onConflictDoNothing for idempotency
- Password hashing utility (server/auth.ts) for secure credential storage
- All organizational data persists across sessions with data integrity guarantees

**Data Models**:
- Zod schemas for runtime validation (drizzle-zod integration)
- Type-safe database operations with TypeScript inference
- Insert schemas generated from table definitions

### Authentication and Authorization

**Current State**: Session-based authentication active
- User schema with email/password fields
- Password hashing using bcryptjs (10 salt rounds)
- Session management with connect-pg-simple for PostgreSQL persistence
- Automatic global admin user initialization on server startup

**Global Admin Users** (created automatically on every server startup):
- `superadmin@vega.com` - vega_admin role, password: `NorthStar2025!`
- `consultant@synozur.com` - vega_consultant role, password: `NorthStar2025!`
- Both users have `tenantId = null` (global access, not tied to specific tenants)
- Upsert pattern ensures users exist with current credentials even in production
- Initialization in `server/init.ts` runs before routes are registered

**Authentication Flow**:
- Session-based authentication using Express sessions
- Secure password hashing and verification
- User lookup by email for authentication
- Multi-tenant support through TenantSwitcher component

**User Roles & Tenant Assignment Model**:
The system supports 6 distinct user roles with different organizational scopes:

1. **tenant_user** - Regular user scoped to a specific organization
   - Must have tenantId assigned
   - Access limited to their organization's data

2. **tenant_admin** - Administrator scoped to a specific organization  
   - Must have tenantId assigned
   - Manages their organization only

3. **admin** - General administrator role
   - Can be assigned to a specific tenant or global (tenantId = null)
   - Flexible scope based on tenant assignment

4. **global_admin** - Platform-wide administrator
   - Typically global (tenantId = null) but MAY have a "home" organization
   - When assigned to a tenant, that's their home org but can work across all clients
   - Example: admin@synozur.com belongs to Synozur but manages all organizations

5. **vega_consultant** - Synozur consultant facilitating Company OS for clients
   - Typically assigned to Synozur tenant as their "home" organization
   - Can facilitate and access any client organization in the system
   - Example: consultant@synozur.com belongs to Synozur but works with all clients

6. **vega_admin** - Vega platform super administrator (highest level)
   - Typically global (tenantId = null) but MAY have a "home" organization  
   - Full platform access regardless of tenant assignment
   - Example: superadmin@vega.com may belong to Synozur internally but manages entire platform

**Key Architectural Notes**:
- Roles are currently stored but **not enforced** (RBAC in backlog for future implementation)
- Cross-tenant roles (global_admin, vega_consultant, vega_admin) can have a home organization while maintaining cross-client access
- Tenant assignment (tenantId) indicates organizational affiliation, not access restriction
- Future RBAC will enforce permissions while preserving this flexible home-org + cross-client model

**Multi-Tenant System**:
- TenantContext provides global tenant state management via React Context
- TenantSwitcher component dynamically fetches tenants from API and allows switching
- Full tenant CRUD operations available in Tenant Admin module:
  - Create: Add new organizations with custom name and brand color
  - Read: View all organizations with visual identification
  - Update: Edit organization name, brand color, and allowed email domains
  - Delete: Remove organizations with confirmation prompt
- **Domain Management** (November 2025):
  - Each tenant can specify allowed email domains (stored in `allowedDomains` JSONB field)
  - "Manage Domains" button on each tenant card shows domain count
  - Dialog interface for adding/removing domains with real-time updates
  - Designed for future SendGrid email validation integration
  - API: PATCH /api/tenants/:id with { allowedDomains: string[] }
- **User Management** (November 2025):
  - Complete user CRUD interface in Tenant Admin module
  - Table view showing email, name, role, and organization for all users
  - Create/Edit/Delete operations with validation
  - Users can be assigned to specific tenants or set as Global (no organization)
  - Password show/hide toggles on all password input fields
  - API endpoints: GET/POST/PATCH/DELETE /api/users
- Seeded demo tenants:
  - Acme Corporation - Blue
  - The Synozur Alliance LLC - Purple  
  - TechStart Inc - Pink
  - Global Ventures - Light Blue
- Each tenant has unique color for visual identification (HSL format support)
- Tenant selection persisted to localStorage across sessions
- All pages (Foundations, Strategy, Planning, FocusRhythm) use useTenant() hook
- Data completely isolated per tenant - foundations, strategies, OKRs, KPIs, rocks, meetings all scoped by tenant ID
- Switching tenants triggers automatic data refresh via React Query cache invalidation
- New tenants start with empty organizational data (no foundations, strategies, etc.)
- **Navigation Stability** (November 2025):
  - sessionStorage-based authentication persistence prevents unwanted redirects during page navigation
  - `vega_was_authenticated` flag tracks authentication state across component unmounts
  - Flag cleared on explicit logout to ensure security

### External Dependencies

**Microsoft 365 Integration**:
- Microsoft Graph Client (@microsoft/microsoft-graph-client) for M365 API access
- Planned integrations: Excel, Outlook Calendar, Microsoft Planner
- OAuth-based authentication flow for M365 tenant connection
- Service connection status tracking in Tenant Admin module
- Meeting link generation for Teams integration
- Calendar event synchronization for Focus Rhythm module

**AI Services**:
- Placeholder implementation for AI-powered features
- Mock endpoints for AI suggestions in Foundations module
- AI chat panel with simulated responses
- Designed for future GPT-based API integration
- AI-generated content for meeting summaries, strategic drafting, and guidance

**UI Component Library**:
- shadcn/ui components built on Radix UI primitives
- Comprehensive component set: buttons, cards, forms, dialogs, dropdowns, etc.
- Accessible components following WAI-ARIA standards
- Customizable through Tailwind classes and CSS variables

**Development Tools**:
- Replit-specific plugins for enhanced development experience
- Runtime error modal overlay for debugging
- Visual development aids (cartographer, dev banner)
- TypeScript for type safety across the codebase

**Build and Bundling**:
- Vite for client-side bundling with React plugin
- esbuild for server-side bundling (ESM format, Node platform)
- PostCSS with Autoprefixer for CSS processing
- Path aliases for clean imports (@/, @shared/, @assets/)

**Form Management**:
- React Hook Form for form state management
- Hookform Resolvers for validation integration
- Zod schemas for form validation rules

**Date Handling**:
- date-fns library for date manipulation and formatting
- Used in quarter selection and meeting scheduling features

**Utility Libraries**:
- class-variance-authority for component variant management
- clsx and tailwind-merge for className composition
- cmdk for command palette functionality
- nanoid for generating unique identifiers