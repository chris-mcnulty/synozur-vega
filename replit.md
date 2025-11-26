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

- ✅ **AI Integration Complete**: Full GPT-5 powered AI assistant with streaming responses:
  - Grounding Documents system for master AI context (methodology, terminology, best practices)
  - Admin UI at /ai-grounding-admin for document management (category-based, priority ordering)
  - Streaming chat endpoint (/api/ai/chat/stream) with Server-Sent Events
  - AI suggestions for OKRs and Big Rocks with strategic context
  - **AI Goal Suggestions** in Foundations module: streaming suggestions based on mission, vision, values, and strategies
  - Uses Replit AI Integrations (AI_INTEGRATIONS_OPENAI_BASE_URL/API_KEY)
- ✅ **Viva Goals Import Fixed**: Complete overhaul of the import system with 8 bug fixes:
  - Numeric overflow fixed (all progress/value fields now doublePrecision)
  - Duplicate merge strategy properly updates existing records
  - Decimal values preserved (no more rounding)
  - Check-ins import with large values (> 1 million) works correctly
  - Big Rocks default to Q1 when quarter not specified
  - Import results: 90 key results, 317 check-ins, 5 big rocks successfully imported
- ✅ **Hierarchical OKR View Complete (Phase 4)**: Full Viva Goals-style interface:
  - HierarchicalOKRTable with separate edit/expand interactions (title click vs chevron button)
  - Badge-based OKRFilters for time period and status with toggle-elevate interactions
  - ObjectiveDialog edit flow from hierarchy view with many-to-many Big Rock linking
  - **OKRDetailPane**: Slide-in detail pane with tabs (Overview, Activity, Big Rocks)
  - **Progress Chart**: Expected vs Actual line chart using check-in history (recharts)
  - **Status Inheritance**: Automatic status derivation from children with manual override capability
  - **Quick Actions**: Hover to reveal Check-in, Add KR, and More options dropdown
  - **Action Dropdown**: Edit, Add Child Objective, Add Key Result, Check-in, Delete
  - **Status Override**: Check-ins that set status mark `statusOverride='true'` to preserve manual status
  - **Closing OKRs**: Closed OKRs remain fully visible to users and AI, but won't generate email reminders and won't be editable unless owner or admin reopens them
  - Comprehensive e2e test passed (27 steps verified)
- ✅ **Values Integration Complete**: Full value tagging with analytics dashboard widget, distribution reports, and value badges in strategic views
- ✅ **Entity Relationship Linking**: Objectives link to strategies/goals, Big Rocks link to strategies
- ✅ **Culture & Values Integration**: Value tagging for Objectives and Strategies (NOT Big Rocks - removed to reduce data clutter)
- ✅ **Foreign Key Constraint Fix**: Empty strings converted to null in update endpoints
- ✅ **Enhanced Documentation**: Created BACKLOG.md, KNOWN_ISSUES.md, TECHNICAL_DECISIONS.md
- ⭐ **Backlog**: AI Big Rock Generator added to AI roadmap (suggest missing initiatives based on strategic analysis)

## System Architecture

### Frontend
- **Framework**: React with TypeScript, utilizing Wouter for routing and shadcn/ui (Radix UI) for components.
- **State Management**: React hooks and TanStack Query.
- **Styling**: TailwindCSS with custom configuration, Avenir Next LT Pro font, CSS variables for design tokens, and responsive design.
- **UI/UX Decisions**: Mimics Orion.synozur.com's aesthetic, emphasizing generous whitespace, card-based layouts, and subtle animations.
- **Technical Implementations & Feature Specifications**:
    - **Company OS Dashboard**: Provides a real-time overview of Foundations (mission, vision, values, annual goals), Strategies, Quarterly OKRs, Big Rocks, and upcoming meetings, with per-section error handling.
    - **Foundations Module**: Manages mission, vision, values, and annual goals, incorporating AI suggestions. Values include both title and description.
    - **Strategy Module**: Facilitates strategy management with AI drafting and goal alignment (many-to-many relationship with annual goals).
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
- **AI Services**: GPT-5 integration via Replit AI Integrations (OpenAI-compatible API). Features streaming chat, OKR suggestions, and Big Rock suggestions. AI context is enhanced via Grounding Documents system.
- **UI Component Library**: shadcn/ui (built on Radix UI primitives).
- **Database**: Neon PostgreSQL.
- **Transactional Email**: SendGrid (via Replit connector) for email verification and password reset.