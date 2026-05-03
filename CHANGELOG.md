# Vega Changelog

**Your AI-Augmented Company Operating System**

This changelog documents new features, improvements, and fixes in Vega. Updates are listed with the most recent changes first.

---

## May 2026

### May 2026 — Version 1.11

**New Features**
- **Galaxy Portal Integration**: Synozur's Galaxy customer portal can now sign users into Vega via an OAuth/JWT trust relationship. New users are JIT-provisioned with the new `portal_user` role and granted read-only access to a dedicated `/api/portal/*` surface covering OKRs, check-ins, and meetings — without ever leaving the Galaxy experience.
- **Live Meeting Mode**: Focus Rhythm meetings now have a facilitator-driven Live Mode with an agenda timer, quick-capture for decisions and risks, attendee tracking, and full state persistence. Reload the page or rejoin from another device — your live meeting is exactly where you left it.
- **Soft Delete & Trash Recovery**: Deleting an objective, key result, big rock, meeting, ambition, or annual goal now sends it to a tenant-scoped Trash instead of erasing it. Admins can preview the item, restore it, or let the 30-day retention window run out. A new admin-only Trash page makes recovery one click.
- **Global Search**: A new header search bar searches across objectives, key results, big rocks, meetings, and people in real time. Results are tenant-scoped, permission-aware, grouped by entity type, and link straight into the matching detail page.
- **In-App Notification Center**: A bell icon in the header now surfaces unread counts, a notifications dropdown, and per-event read/unread tracking. Assignments, mentions, check-in reminders, and admin alerts now appear in-app instead of relying solely on email.
- **Bulk Reassignment**: Admins can reassign every objective, key result, and big rock owned by one user to another in a single action — built for offboarding, team restructures, and consultant handoffs.
- **Mobile-Responsive OKR Tables**: Hierarchical OKR tables now collapse into a card-stack layout on phones and tablets, with progressive disclosure of key results, owners, and progress. Stand-ups from a phone are now actually pleasant.
- **Daily Progress Snapshots**: A new background job captures a daily snapshot of every objective and key result. These snapshots power historical trend lines, period-over-period comparisons, and the Executive Dashboard's completion-forecast charts.
- **Check-in Draft Auto-Save**: Check-in dialogs now auto-save drafts as you type. A new Drafts list lets you restore or discard a saved draft, drafts are tenant-scoped so they never leak across organizations, and submitting a check-in clears its draft automatically. Three follow-up polish items shipped alongside: clear-on-submit, conflict handling, and Drafts management UI.

**Improvements**
- **Combined-Context Dashboard API**: The Company OS, Executive, and Team dashboards now load through a single combined-context endpoint instead of fanning out 6+ requests per render. Dashboards feel instant, even on large tenants.
- **Recursive CTE Hierarchy Loader**: The OKR hierarchy is now loaded with a single recursive CTE that pulls the full objective tree (and its key results and big rocks) in one query. Large-tenant page loads that previously took multiple seconds now resolve in milliseconds.
- **Objective Tree Depth-Cap Admin Alerts**: The backend now caps objective hierarchy depth at an admin-tunable threshold and surfaces alerts when a tenant's tree approaches or exceeds the cap. Helps prevent runaway alignment chains and keeps the hierarchy navigable.

**Quality**
- **Depth-Cap & Cycle Detection Tests**: Comprehensive automated coverage for the new depth cap, cycle detection, and warning emission paths so future schema work can't silently regress hierarchy safety.
- **GIN Trigram Index Deploy Fix**: Publish was failing with "data type text has no default operator class for access method gin" because Replit's deployment migration analyzer strips the `gin_trgm_ops` operator class from top-level `CREATE INDEX … USING GIN (col gin_trgm_ops)` DDL — whether in a `.sql` migration file or in runtime `client.query()` calls at startup. Fix: all 17 trgm index creations are now consolidated in `migrations/0012_search_trgm_indexes.sql` using a `DO $$` block with `EXECUTE` statements, which the analyzer treats as a single opaque SQL statement and cannot parse inside. The `init.ts` runtime loop has been removed; only the harmless `CREATE EXTENSION IF NOT EXISTS pg_trgm` safety net remains there.

> **Release bookkeeping note for admins:** to push this entry into the in-app What's New modal, an admin should call `POST /api/admin/changelog/refresh` once after deploy. New users will then see the Version 1.11 highlights on next dashboard load.

---

## April 2026

### April 8, 2026 - Version 1.10

**New Features**
- **OKR Creation Wizard — Draft Auto-Save**: The Create OKR wizard now automatically saves your progress as you type. Close the dialog, navigate away, or come back tomorrow — your draft objective, key results, and big rocks are waiting for you. Drafts are scoped per tenant so your work never leaks across organizations. A banner lets you know when a draft has been restored, with a one-click "Discard draft" button if you want a fresh start. Drafts clear automatically on successful submit.
- **Contextual Breadcrumbs**: A new breadcrumb trail now appears below the main header on every authenticated page. It shows the path from Home to your current location, with type icons on each level. Section roots (Planning, Focus Rhythm, About, Administration) carry a quick-action dropdown that lets you jump sideways without navigating back first. Long paths are smart-truncated into an ellipsis dropdown so the trail never overwhelms the header.
- **Monthly What's New Refresh Endpoint**: Platform admins can now trigger `POST /api/admin/changelog/refresh` after editing CHANGELOG.md in production. The server re-reads the changelog, picks up the new version, and clears the What's New summary cache so every user sees the fresh modal on their next request — no server restart required. Supports the new monthly release cadence.

**Improvements**
- **OKR Wizard Query Invalidation**: The wizard now invalidates OKR caches via the shared `invalidateOKRQueries()` helper, ensuring tenant-scoped composite query keys refresh correctly after creating a new objective hierarchy.
- **Support Ticket Staff Assignment**: Admins can now assign tickets to any Vega Admin or Consultant staff member via a new "Assign To" dropdown in the ticket detail sidebar. Assignee avatar and name display in the ticket list. New `GET /api/support/staff` endpoint serves the staff roster.
- **Support Ticket Reply Email Notifications**: Bidirectional email notifications for ticket replies. When staff posts a non-internal reply, the ticket author receives an email. When a user replies, the assigned staff member (or all admins if unassigned) gets notified. Internal notes never trigger email.
- **Support Admin "Pending" Filter**: New compound status filter combining Open + In Progress tickets. Available as a status dropdown option and as a clickable stat card for quick access.
- **Support Admin "My Assigned" Filter**: New stat card and filter preset showing only tickets assigned to the current admin. Dedicated "Assigned To" dropdown filter lets admins filter by any staff member.
- **Category-to-Priority Defaults**: New ticket form now auto-sets priority based on category selection (bug → high, question/feature request → medium, feedback → low). Users can still manually override. Changing category resets the auto-default.
- **`getVegaAdminUsers()` scope expanded**: Now returns both `vega_admin` and `vega_consultant` role users for consistent staff roster across the platform.
- **Support Ticket Status History**: Every change to a ticket's status, priority, assignee, or category is now recorded in a `support_ticket_history` audit table. The admin ticket detail view renders a "Status History" timeline showing what changed, who changed it, and when — including human-readable assignee names.
- **Bulk Ticket Actions**: Admins can now select multiple tickets via per-row checkboxes (with "select all on page") and apply bulk operations from a floating action bar: change status, reassign to any staff member, or close all selected tickets in one click. Backed by the new `POST /api/support/tickets/bulk` endpoint; writes history rows and fires notifications per ticket.
- **Quick Reply Templates**: Five built-in canned response templates (Acknowledged, Investigating, Fix Deployed, Need More Info, Closing) are available in the admin reply composer via a "Quick reply templates" dropdown. Selecting a template inserts its body into the reply textarea, appending to any existing text.
- **Admin Full-Text Search**: A search input with a clear button appears at the top of the admin ticket filter bar. Results filter in real-time across ticket subject, description, and reply message bodies, composing with all existing status / priority / category / assignee filters.

**Bug Fixes**
- **Executive Dashboard — Empty Objectives (Production)**: Fixed a production bug where the Executive Dashboard showed "No objectives found" for all quarterly views. Root cause: objectives created without a quarter assignment (`quarter=NULL`) represent annual/unquartered OKRs, but the backend storage query only matched objectives with the exact quarter number requested — silently excluding all null-quarter records. Fix: quarterly view queries now use `quarter = N OR quarter IS NULL`, so annual OKRs are always visible regardless of the time period filter. The same fix applies to the Company OS Dashboard, hierarchy view, and key results roll-ups. Multi-period client-side filter in the Outcomes page updated to also always include null-quarter objectives.
- **Completion Forecast — All Zeros (Production)**: Fixed a production bug where the Completion Forecast panel on the Executive Dashboard displayed 0 High Confidence, 0 Moderate, 0 At Risk, and 0% avg. probability even when objectives existed. Two root causes: (1) the `/api/okr/forecasts` endpoint was filtering objectives with strict quarter equality (excluding all null-quarter annual OKRs that make up the majority of the tenant's objectives), now fixed to use the same null-inclusive query as the rest of the platform; (2) the velocity/projection engine had no date-range fallback for null-quarter annual objectives, causing them to return `insufficient_data` with zero percentageThrough — now correctly defaults to the full calendar year (Jan 1 – Dec 31) for annual objectives, enabling accurate pace and completion probability calculations.

**Bug Fixes (cont.)**
- **OKR Wizard — Silent "Next" Button on Step 2**: Fixed a UX bug where the Create OKR wizard's Next button on the Key Results step was silently disabled when a key result had no title, giving users no feedback and making the wizard appear broken. The button is now always clickable — clicking Next with incomplete key results shows a toast error ("Key result title missing") and highlights the offending input with a red border and inline error message. Fixing or deleting the empty key result clears the error and allows progression.
- **Completed Objectives Stuck at Stale Progress**: Fixed a production bug where objectives marked "completed" retained their last check-in progress value (e.g., 40%) instead of showing 100%. Three-layer fix: (1) Storage layer — all objective fetch functions (`getObjectivesByTenantId`, `getObjectiveById`, `getChildObjectives`) now normalize any completed objective to 100%, resolving all historical stuck data immediately on next page load. (2) Check-in handler — backend now enforces `newProgress = 100` when `newStatus = 'completed'` for objectives and big rocks, preventing future data drift. (3) Check-in dialog — selecting "Completed" status in the check-in form now automatically advances the progress slider to 100%.

**Visual Polish — Aurora UX Parity**
- **Rounded corners applied globally**: Migrated all UI primitives (Card, Input, Textarea, Select trigger/content, Dialog, Popover) from `rounded-none` to `rounded-md`/`rounded-lg`, matching Constellation's polished corner radius standard. `--radius` CSS variable set to `0.5rem` in both light and dark mode.
- **Richer dark mode depth**: Dark background palette deepened to navy-purple tones (`--background: 230 18% 11%`, `--sidebar: 230 22% 7%`, `--card: 230 15% 17%`), creating a clear visual elevation hierarchy across background → card → popover surfaces.
- **Active sidebar background fill**: Active navigation items in dark mode now show a subtle purple-tinted gradient background (`hsl(277 35% 22% / 0.7)`) in addition to the 3px brand gradient left bar, matching Constellation's sidebar treatment.
- **Purple-tinted shadows (both modes)**: All shadow depth levels updated with purple-tinted base colors — light mode uses `hsl(277 50% 30%)` at deeper opacity, dark mode uses `hsl(277 30% 2%)` for dramatic elevation with consistent brand character.

**Documentation & Planning**
- BACKLOG.md Executive Summary refreshed — stale 2025-dated phase references replaced with current Q2 2026 priorities
- OKR Creation Wizard and Contextual Breadcrumbs marked as shipped
- New "Support Ticket Finishing Pass" plan added to BACKLOG.md with a 10-item gap list based on the current Vega codebase (staff assignment UI, status history, SLA timers, bidirectional reply notifications, bulk actions, resolution templates, admin search, and more)
- Support Ticket Finishing Pass Week 1 items (1, 4, 5, 9) and Week 2 items (2, 6, 7, 8) marked complete in BACKLOG.md; only SLA timer badges (item 3) and chatbot deflection metric (item 10) remain open
- **Aurora Visual System implemented** — full port from Constellation brand standard, including animated blob background component, cosmic-text gradient headings, synozur-gradient/glow/shimmer utilities, nebula-card animated border, sidebar active-gradient indicator, page header gradient bar, and purple-tinted shadows

---

## February 2026

### February 8, 2026 - Version 1.9

**New Features**
- **Help Chatbot**: AI-powered help assistant accessible from the Help button in the header toolbar
  - Answers questions about using Vega based on the official User Guide
  - Streaming responses for a smooth conversational experience
  - "Open Support Ticket" escalation button pre-fills ticket form with conversation summary
- **Support Ticket System**: Full support ticket lifecycle for bug reports, feature requests, questions, and feedback
  - Create, view, and track support tickets with category, priority, and status management
  - Reply threads for back-and-forth communication between users and admins
  - Email notifications via SendGrid: acknowledgment to users and alerts to platform admins
  - Support page accessible from the sidebar with ticket list, detail view, and new ticket form
- **Admin Support Dashboard**: Cross-tenant ticket management for platform admins in System Admin
  - Filter tickets by status, priority, category, and tenant
  - Update ticket status and priority, assign tickets
  - Internal notes visible only to admins for team coordination

**Improvements**
- System Admin now includes a "Support" tab for global ticket management
- Help button added to main header toolbar for quick access to AI-powered help

---

### February 7, 2026 - Version 1.8

**New Features**
- **Microsoft Planner Integration (Priority 1)**: Link Planner tasks directly to Objectives and Big Rocks for unified progress tracking
  - Planner Task Link Panel in Objective and Big Rock detail views with task status, progress bars, and due dates
  - Planner management section in Tenant Admin Integrations tab with connection status, sync metrics, and manual sync controls
  - Automatic background sync every 4 hours via Job Scheduler
  - Independent OAuth flow (no Outlook dependency) with Tasks.ReadWrite scope
  - Token expiry detection with reconnect banners and error recovery
- **What's New Modal**: See a friendly AI-powered summary of recent platform updates when you log in after a new release. First-time users see the Launchpad welcome instead and are silently updated to the current version. Tenant admins can toggle this feature on or off in General settings.
- **Full Changelog Page**: Browse the complete history of Vega updates from a dedicated page accessible from the sidebar, with search, table of contents, and scroll-to-top.
- **Annual Goals in Outcomes**: Annual Goals have moved from Foundations to the Outcomes module for tighter alignment with OKR planning workflows. All functionality preserved including AI suggestions, ambition linking, cloning, and year selectors.

**Improvements**
- Job Scheduler now supports killing stuck job runs with confirmation dialog and audit trail (records killedByUserId and killedAt)
- Job Scheduler supports schedule editing with presets from every minute to daily intervals (vega_admin only)
- Job Scheduler now runs 3 system jobs: expiration-reminders (daily), reminder-cache-reset (daily), planner-sync (every 4 hours)
- Enhanced OKR Intelligence with improved velocity projections

**Performance**
- Executive Dashboard now fetches all key results in a single batch request instead of one per objective, significantly reducing load times for large tenants
- Storage layer batch methods (getKeyResultsByObjectiveIds, getCheckInsByEntityIds) with in-memory query caching (60-second TTL) and automatic cache invalidation on writes
- Report generation and COS export use batch queries to eliminate N+1 database patterns

---

### February 2, 2026 - Version 1.7

**New Features**
- **Ambitions Module**: Add 3-5 year strategic targets as a new strategic layer above Annual Goals
  - Create, edit, close, and reopen long-term ambitions with target years (3-10 years out)
  - Link ambitions to organizational values for strategic alignment
  - Active/Closed tab filtering with soft limit warning at >5 active ambitions
  - Annual Goals can now optionally link to parent Ambitions
  - Closing notes captured when marking ambitions complete

**API & Integration Updates**
- New `get_ambitions` MCP tool with status and targetYear filters
- Enhanced `get_annual_goals` MCP tool with `includeAmbitions` parameter for linked ambition resolution
- OpenAPI specification updated with Ambition and enhanced AnnualGoal schemas
- Export/Import now includes Ambitions with backward compatibility for older files

**Documentation**
- User Guide updated with comprehensive Ambitions documentation
- Backlog and roadmap updated to reflect v1.7 completion

---

## January 2026

### January 31, 2026

**New Features**
- **Job Scheduler Dashboard**: View and manage all scheduled background jobs from the System Admin page
  - Jobs list showing status (Active/Paused), schedule, category, and last/next run times
  - Run history with status indicators (Success/Failed/Running) and execution details
  - Manual job controls: Run Now, Pause, Resume (vega_admin only)
  - View-only access for tenant_admin users
  - Automatic email notifications to all platform admins when jobs fail
  - Two system jobs configured: Expiration Reminders (daily) and Reminder Cache Reset (daily)

**Improvements**
- System Admin now includes a "Scheduled Jobs" tab for job monitoring
- Job failure alerts include detailed error information and stack traces

---

### January 17, 2026

**New Features**
- **MCP Server (Model Context Protocol)**: Connect external AI assistants like Claude Desktop and Cursor to your Vega data
  - 12 MCP tools: 9 read operations (OKRs, Big Rocks, Strategies, Mission, Vision, Values, Annual Goals, Teams, Meetings) and 3 write operations (update KR progress, add check-in notes, update Big Rock status)
  - Secure API key authentication with bcrypt hashing and short-lived JWT tokens
  - Scope-based permissions for granular access control
  - IP allowlisting with CIDR notation support
  - Key rotation with configurable grace periods
  - Rate limiting (60 requests/minute per tenant)

**Improvements**
- Admin-only access for MCP API key management (create, update, rotate, revoke)
- Full audit logging for all MCP tool invocations

---

### January 13, 2026

**New Features**
- **Clone Big Rocks**: You can now clone Big Rocks to different quarters or years, similar to cloning objectives. Options include keeping the original owner and linked OKRs

**Improvements**
- Annual view in Outcomes now shows all Big Rocks for the year (both quarterly and annual), not just annual-only items

**Bug Fixes**
- AI Executive Insights slide now appears in PowerPoint reports generated from snapshots (previously only appeared for current state reports)

---

### January 11, 2026

**New Features**
- **AI Period Summary in Reports**: GPT-5 generates executive headlines, key themes (max 4), and strategic guidance for your reports
- **Dynamic Date Selection for Reports**: Choose the exact period for your report with appropriate selectors:
  - Weekly reports: Pick from the last 12 weeks
  - Monthly reports: Select any month
  - Quarterly reports: Choose quarter and year
  - Annual reports: Select year

**Improvements**
- Added privacy policy and terms of service links to login page
- Updated social sharing preview image with proper Vega branding
- Reports now use correct date windows (7 days for weekly, 30 days for monthly, etc.) instead of always using quarterly ranges
- AI Period Summary slide added to PowerPoint exports with branded styling

**Performance**
- Added database performance indexes for faster loading of OKRs, check-ins, and meetings

---

### January 10, 2026

**New Features**
- **Delete Check-in**: You can now delete check-ins you've created. When deleted, progress reverts to the previous check-in's values

**Improvements**
- Excel auto-sync now creates proper check-in records with sync notes
- AI-powered check-in rewrite now considers your pace against the period timeline

---

### January 9, 2026

**New Features**
- **Executive Dashboard Personalization**: Customize which sections appear on your executive dashboard
- **OKR Intelligence Phase 1**: Pace badges show whether you're on track, ahead, or behind schedule

**Improvements**
- Behind Pace alerts on Executive Dashboard with severity sorting
- Velocity projections displayed in pace badges

---

## December 2025

### December 31, 2025

**New Features**
- **OKR Period Close-Out**: When checking in on past period items, choose to continue in a new period or close with notes
- **OKR Cloning**: Clone objectives with various scope options and target quarter/year selection

**Improvements**
- Pacific Time detection for period boundaries
- Closing notes are now mandatory when ending an OKR

---

### December 15, 2025 - Version 1.0 Release

**Major Milestone: Production Release**

Vega 1.0 marks our official production release with full Company OS capabilities:

**Core Platform**
- Complete OKR management with hierarchical objectives, Key Results, and Big Rocks
- Strategy development and alignment tools
- Foundations module for mission, vision, values, and annual goals
- Focus Rhythm meeting management with templates and agendas

**Microsoft 365 Integration**
- Microsoft Entra ID single sign-on
- Microsoft Planner integration with bidirectional sync
- OneDrive/SharePoint file picker
- Outlook Calendar sync

**AI-Powered Features**
- Launchpad document analysis for Company OS generation
- AI suggestions for OKRs and Big Rocks
- Streaming chat assistance

**Enterprise Features**
- Multi-tenancy with data isolation
- Role-based access control (6 roles, 20+ permissions)
- Custom vocabulary per tenant
- Custom branding with dark mode support
- PDF and PowerPoint report exports

---

## How to Read This Changelog

- **New Features**: Brand new capabilities added to the platform
- **Improvements**: Enhancements to existing features
- **Bug Fixes**: Issues that have been resolved
- **Performance**: Speed and efficiency improvements
- **Security**: Security-related updates

---

## Feedback

Have suggestions or found an issue? Contact us at [Vega@synozur.com](mailto:Vega@synozur.com)
