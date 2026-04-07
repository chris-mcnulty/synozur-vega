# Copilot Instructions for synozur-vega (Vega Platform)

## What Is This Project?

Vega is a **multi-tenant SaaS Company Operating System (Company OS)** built by Synozur. It helps organizations align strategy with execution using AI-powered modules for foundations (mission/vision/values), strategy development, OKRs, and focus rhythm (meetings). It supports both consultant-led and self-service models and integrates deeply with Microsoft 365.

---

## Read These Files First

Before writing or modifying any code, always read:

1. **`replit.md`** — master architecture reference: system design, multi-tenancy rules, auth patterns, external integrations, modules, AI services, and the full feature list. This is the single source of truth for architecture.
2. **`BACKLOG.md`** — single source of truth for all feature specs, implementation plans, known issues, and technical decisions (2,800+ lines). Check here before implementing any feature to avoid duplication.
3. **`CLAUDE.md`** — standing development rules for this codebase (read before making any change).
4. **`USER_GUIDE.md`** — complete feature reference from a user perspective, useful for understanding what each module is supposed to do.
5. **`design_guidelines.md`** — typography, layout, color, and component design rules that all UI must follow.

Do **not** create new planning documents, backlog files, or spec markdown files. Use `BACKLOG.md` for all tracking.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend framework | React 18 + TypeScript |
| Routing | Wouter |
| UI components | shadcn/ui (Radix UI primitives) |
| Styling | TailwindCSS + CSS variables + Avenir Next LT Pro font |
| State / data fetching | TanStack Query v5 |
| Backend | Express.js + Node.js (ESM) |
| ORM | Drizzle ORM |
| Database | Neon PostgreSQL |
| Auth | Session-based (express-session + connect-pg-simple + bcryptjs) + Microsoft Entra ID SSO (MSAL) |
| Email | SendGrid |
| AI providers | OpenAI / Azure OpenAI / Anthropic / Replit AI (switchable at runtime) |
| M365 integration | Microsoft Graph Client (Planner, Outlook, Excel, SharePoint) |
| MCP server | @modelcontextprotocol/sdk |
| Build | Vite (frontend) + esbuild (server) |

---

## Development Commands

```bash
# Start the dev server (frontend + backend together, hot reload)
npm run dev

# Type-check everything (no emit)
npm run check

# Production build (Vite frontend + esbuild server bundle → dist/)
npm run build

# Run production build
npm start

# Push schema changes to DB (uses drizzle-kit)
npm run db:push
```

There is **no separate test command** — the project does not have a test suite at the time of writing. Validate changes by running `npm run check` for TypeScript type correctness and manually exercising the relevant feature.

---

## ⚠️ CRITICAL: Multi-Tenancy Rules (Non-Negotiable)

This is a multi-tenant platform. **Every data access must be tenant-scoped.**

1. **TanStack Query keys** that fetch tenant data must always include `tenantId`:
   ```ts
   // ✅ Correct
   useQuery({ queryKey: ["/api/okr/objectives", tenantId, quarter, year] })
   // ❌ Wrong — no tenant scope
   useQuery({ queryKey: ["/api/okr/objectives"] })
   ```

2. **Every API call** must include `tenantId` in the request params or body. The `apiRequest()` helper in `client/src/lib/queryClient.ts` automatically adds the `x-tenant-id` header from `localStorage.currentTenantId`.

3. **Cache invalidation** must always include `tenantId` in the query key:
   ```ts
   // ✅ Correct
   queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives", tenantId] });
   // ❌ Wrong — bare key clears across all tenants
   queryClient.invalidateQueries({ queryKey: ["/api/okr/objectives"] });
   ```

4. **Never use a fallback empty string** for `tenantId` (e.g., `tenantId ?? ""`). If `tenantId` is missing, the operation must not proceed.

5. Server routes that use the `requireValidatedTenant` middleware read the tenant from the `x-tenant-id` header; the middleware validates the user has access to that tenant (see `server/middleware/validateTenant.ts`).

---

## Authentication & Authorization

### Session Auth (default)
- Sessions stored in PostgreSQL via `connect-pg-simple`
- Login/logout via `server/auth.ts` (Passport local strategy)
- `req.user` is available on all authenticated routes
- Email verification flow via SendGrid

### Microsoft Entra ID SSO
- MSAL-based multi-tenant Azure AD authentication in `server/routes-entra.ts`
- JIT user provisioning on first SSO login
- Per-user tokens stored in `graph_tokens` table for Microsoft Graph calls

### RBAC
Six roles defined in `shared/rbac.ts`:

| Role | Description |
|---|---|
| `tenant_user` | Standard user in a tenant |
| `tenant_admin` | Admin within one tenant |
| `admin` | Legacy admin role |
| `global_admin` | Cross-tenant read/write access |
| `vega_consultant` | Consultant with explicit tenant grants |
| `vega_admin` | Platform-wide admin |

- Use the `usePermissions()` hook (`client/src/hooks/use-permissions.ts`) for frontend permission checks.
- Server-side: use `canUserModifyOKR()` / `canUserDeleteOKR()` helpers in `server/routes-okr.ts`.
- `canAccessAnyTenant()` in `shared/rbac.ts` returns true for `vega_admin` and `global_admin`.

---

## File Structure Guide

```
/
├── replit.md                   # ← Architecture reference (read first)
├── BACKLOG.md                  # ← Feature backlog & specs (read first)
├── CLAUDE.md                   # ← Dev rules for this repo
├── USER_GUIDE.md               # ← User-facing feature docs
├── design_guidelines.md        # ← UI/UX design rules
├── shared/
│   ├── schema.ts               # Drizzle ORM table definitions + Zod schemas + TypeScript types
│   ├── enhanced-okr-schema.ts  # Extended OKR schema
│   ├── rbac.ts                 # Role/permission definitions + helpers
│   └── publicDomains.ts        # Public email domain list (invite-only enforcement)
├── server/
│   ├── index.ts                # Entry point; Express setup
│   ├── routes.ts               # Main route file (auth, tenants, users, meetings, etc.)
│   ├── routes-okr.ts           # OKR routes (objectives, key results, big rocks, check-ins)
│   ├── routes-ai.ts            # AI feature routes
│   ├── routes-m365.ts          # Microsoft 365 integration routes
│   ├── routes-planner.ts       # Microsoft Planner routes
│   ├── routes-outlook.ts       # Outlook Calendar routes
│   ├── routes-entra.ts         # Entra ID SSO routes
│   ├── routes-reporting.ts     # PDF/PPTX export routes
│   ├── routes-launchpad.ts     # AI Launchpad wizard routes
│   ├── routes-support.ts       # Help chatbot + support ticket routes
│   ├── routes-export.ts        # Export routes
│   ├── routes-import.ts        # Import routes
│   ├── routes-jobs.ts          # Background job scheduler routes
│   ├── routes-values.ts        # Culture & values routes
│   ├── storage.ts              # IStorage interface + DatabaseStorage implementation
│   ├── db.ts                   # Drizzle DB connection (Neon)
│   ├── auth.ts                 # Passport strategy + session setup
│   ├── ai.ts                   # AI provider abstraction + completion helpers
│   ├── ai-tools.ts             # AI function-calling tools
│   ├── okr-intelligence.ts     # OKR pace/velocity analytics + forecasting
│   ├── microsoftGraph.ts       # Microsoft Graph API helpers
│   ├── email.ts                # SendGrid email helpers
│   ├── hubspot.ts              # HubSpot CRM integration
│   ├── pdf-service.ts          # PDF export via pdfkit
│   ├── pptx-service.ts         # PPTX export via pptxgenjs
│   ├── middleware/
│   │   ├── validateTenant.ts   # Tenant validation middleware (x-tenant-id header)
│   │   └── rbac.ts             # RBAC middleware
│   ├── mcp/                    # MCP server (Model Context Protocol for AI tools)
│   └── services/               # Background services (job scheduler, Planner auth, etc.)
├── client/src/
│   ├── App.tsx                 # Root: routing, layouts, global contexts
│   ├── contexts/
│   │   ├── AuthContext.tsx     # Current user + login/logout
│   │   ├── TenantContext.tsx   # Current tenant + tenant switcher
│   │   ├── TimePeriodContext.tsx # Global quarter/year selector
│   │   └── VocabularyContext.tsx # Customizable terminology
│   ├── hooks/
│   │   ├── use-permissions.ts  # RBAC permission checks in UI
│   │   ├── use-pace-metrics.ts # OKR pace/velocity calculations
│   │   └── use-toast.ts        # Toast notifications
│   ├── lib/
│   │   ├── queryClient.ts      # TanStack Query client, apiRequest(), invalidation helpers
│   │   └── utils.ts            # General utilities
│   ├── pages/                  # One file per route/page
│   └── components/             # Reusable UI components
│       ├── okr/                # OKR-specific components
│       ├── meetings/           # Meeting/Focus Rhythm components
│       ├── admin/              # Admin panel components
│       ├── planner/            # Microsoft Planner components
│       └── ui/                 # shadcn/ui base components
├── migrations/                 # Drizzle SQL migration files
├── drizzle.config.ts           # Drizzle config pointing to Neon DB
└── vite.config.ts              # Vite config (frontend build + dev proxy)
```

---

## Database & Schema Patterns

- All tables are defined in `shared/schema.ts` (and `shared/enhanced-okr-schema.ts`).
- Drizzle ORM uses `pgTable`. Every table has a UUID primary key using `id: varchar("id").primaryKey().default(sql`gen_random_uuid()`)` (template literal with Drizzle's `sql` tag).
- Insert schemas are generated with `createInsertSchema(table).omit({ id: true, createdAt: true })`.
- After changing the schema, run `npm run db:push` to apply changes to the Neon DB.
- All date/time operations use the **America/Los_Angeles** timezone (Pacific Time).
- Tenant data isolation is enforced via `tenantId` foreign keys on every tenant-scoped table.

---

## Backend Patterns

### Route Structure
- Routes are registered in `server/index.ts` which imports from all `routes-*.ts` files.
- All authenticated routes call `requireAuth` middleware.
- Tenant-scoped routes call `requireValidatedTenant` middleware, which reads `x-tenant-id` header.
- Meeting records use a `date` field (timestamp), not `meetingDate`.
- Meetings are fetched via `GET /api/meetings/:tenantId`.

### Storage Interface
`server/storage.ts` exports an `IStorage` interface and a `DatabaseStorage` class. All DB access in route handlers goes through `storage.*()` methods — never call Drizzle directly in route files.

### AI Provider
`server/ai.ts` provides `generateAIResponse()` which routes to the active AI provider (configurable per-tenant or platform-wide). Do not call OpenAI/Anthropic SDKs directly in routes — use the abstraction.

---

## Frontend Patterns

### Routing
Uses Wouter (not React Router). Route definitions are in `client/src/App.tsx`.

### Data Fetching
- Use TanStack Query `useQuery` / `useMutation` for all server state.
- Always import `apiRequest` from `client/src/lib/queryClient.ts` for mutations.
- Use the exported cache invalidation helpers (`invalidateOKRQueries`, `invalidateMeetingQueries`, etc.) after mutations instead of constructing raw invalidation calls.

### Contexts (always available via hooks)
- `useAuth()` — current user, login/logout
- `useTenant()` — current tenantId + tenant object
- `useTimePeriod()` — current quarter + year
- `useVocabulary()` — customizable term overrides

### Components
- All base UI components are in `client/src/components/ui/` (shadcn/ui).
- Do not add raw Tailwind utility classes when a shadcn component exists.
- Follow `design_guidelines.md` for font weights, spacing, and layout conventions.
- Avenir Next LT Pro renders heavier than most fonts — use lighter weights than typical (semibold for page headers, medium for card titles, regular for body).

---

## Microsoft 365 Integration

- **Planner**: multi-tenant app-only `client_credentials` auth via `server/services/planner-auth.ts`. Azure tenant ID comes from each Vega tenant's `azureTenantId` DB field, not an env var.
- **Outlook Calendar**: dual auth — tries per-user Entra token from `graph_tokens` table first, falls back to connector token. All M365 calendar routes use `*ForUser()` functions in `microsoftGraph.ts`.
- **Excel**: data binding for Key Results.
- All Graph functions accept `azureTenantId` to target the correct tenant's token endpoint.

---

## AI & MCP

- AI usage is tracked and visible to tenant admins and platform admins.
- MCP server (`server/mcp/`) exposes Vega data to compatible AI tools with JWT auth and scope-based permissions.
- Dual Copilot Studio auth paths:
  - **(A) Entra JWT** (`server/mcp/entra-jwt.ts`) — validates Microsoft Entra ID tokens via JWKS. Env vars: `MCP_ENTRA_CLIENT_ID`, `MCP_ENTRA_ALLOWED_TENANTS`.
  - **(B) Vega OAuth 2.0** — built-in authorization server at `/oauth/authorize`, `/oauth/token`.
- OpenAPI spec is at `/openapi.yaml` and `/openapi.json`. Declarative agent manifests in `/public/copilot-agent/`.

---

## Environment Variables

The following env vars are required at runtime (never commit them):

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string |
| `SESSION_SECRET` | Express session signing key |
| `SENDGRID_API_KEY` | Transactional email |
| `OPENAI_API_KEY` | OpenAI (if using OpenAI provider) |
| `AZURE_OPENAI_API_KEY` | Azure OpenAI (if using Azure provider) |
| `ANTHROPIC_API_KEY` | Anthropic (if using Anthropic provider) |
| `AZURE_CLIENT_ID` | Shared multi-tenant Azure app registration |
| `AZURE_CLIENT_SECRET` | Azure app secret |
| `HUBSPOT_API_KEY` | HubSpot CRM |
| `MCP_ENTRA_CLIENT_ID` | MCP server Entra JWT audience |
| `MCP_ENTRA_ALLOWED_TENANTS` | Optional comma-separated allowed Entra tenant IDs |

---

## Key Conventions

1. **No new planning files** — all specs and backlog items go in `BACKLOG.md`.
2. **No new files when editing an existing one will do.**
3. **No extra features, refactoring, or comments beyond what was asked.**
4. **Match the patterns already used in the file being edited.**
5. **Always read the existing code before modifying it.**
6. Every new DB table needs a `tenantId` foreign key if it holds tenant-scoped data.
7. Drizzle insert schemas must omit `id` and `createdAt` — these are DB-generated.
8. New API routes must be added to the relevant `routes-*.ts` file (or `routes.ts` for general routes), not directly in `server/index.ts`.
9. New pages go in `client/src/pages/`, new reusable components in `client/src/components/`.
10. The `VocabularyContext` provides user-customizable terminology — always use vocabulary terms for user-visible labels (e.g., "Objective" might be customized to "Goal").

---

## Known Issues & Workarounds

- The project runs on Replit; the dev server is started with `npm run dev` which runs `tsx server/index.ts` directly.
- Vite is configured to proxy all `/api/*` requests to the Express backend in development (see `vite.config.ts`).
- The `@replit/vite-plugin-*` devDependencies are Replit-specific and only used in dev mode; they can be ignored in non-Replit environments.
- If schema changes cause type errors, run `npm run db:push` first, then `npm run check`.
- `tailwindcss` v3 is used (not v4), despite `@tailwindcss/vite` being present — the Tailwind config is `tailwind.config.ts`.
