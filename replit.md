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
- Planning module for OKRs, KPIs, and quarterly rocks
- Focus Rhythm module for meeting management and summaries
- Tenant Admin for M365 service integration management

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
- Storage interface (IStorage) defines CRUD operations
- Current implementation uses MemStorage for development
- Prepared for database integration via storage interface abstraction
- User management with UUID-based IDs and username/password fields

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

**Current State**: Basic user model prepared
- User schema with username/password fields
- No active authentication implementation yet
- Session infrastructure prepared (connect-pg-simple for PostgreSQL sessions)

**Planned Approach**:
- Session-based authentication using Express sessions
- Credential storage in database with secure password hashing
- User lookup by username for authentication
- Multi-tenant support through TenantSwitcher component

**Multi-Tenant System**:
- TenantSwitcher component allows switching between organizations
- Available tenants: Acme Corporation (default), The Synozur Alliance LLC, TechStart Inc, Global Ventures
- Each tenant has a unique color for visual identification
- Tenant selection stored in component state (future: persist in user profile)

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