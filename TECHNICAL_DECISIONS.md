# Technical Decisions & Architecture

**Last Updated:** November 22, 2025

This document records significant technical decisions made during Vega development, following the Architecture Decision Record (ADR) format.

---

## Authentication & Security

### ADR-001: Session-Based Authentication

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need secure, scalable authentication for multi-tenant SaaS application.

**Decision:**
Use Express sessions with PostgreSQL storage (`connect-pg-simple`) instead of JWT tokens.

**Rationale:**
- Simpler to implement and secure for server-rendered pages
- Session data stored server-side (more control)
- Easy to invalidate sessions (logout, security events)
- Works well with existing PostgreSQL infrastructure
- No token expiration complexity for users

**Consequences:**
- ✅ Server-side session control
- ✅ Automatic session persistence across server restarts (PostgreSQL storage)
- ✅ Easy to add multi-device session management later
- ❌ Requires sticky sessions for horizontal scaling (can be solved with Redis later)
- ❌ CORS complexity for API-only clients (future consideration)

**Alternatives Considered:**
- JWT tokens (stateless, but harder to revoke)
- Passport.js (unnecessary abstraction layer)

---

### ADR-002: Email Verification System

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Prevent spam signups and verify user ownership of email addresses.

**Decision:**
Implement email verification with hashed tokens stored in database.

**Implementation:**
- Generate random token on signup
- Hash token before storing in DB (security best practice)
- Send plaintext token to user's email via SendGrid
- User clicks link → hash incoming token → compare with DB
- Mark `emailVerified: true` on successful verification

**Rationale:**
- Prevents spam/bot registrations
- Ensures users have access to the email they claim
- Hashed tokens prevent DB leak exploitation
- SendGrid provides reliable delivery and analytics

**Consequences:**
- ✅ Reduced spam signups
- ✅ Secure token storage
- ✅ Professional email delivery
- ❌ Requires SendGrid API key configuration
- ❌ Users must check email before accessing platform

---

### ADR-003: Multi-Tenancy via tenantId

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Support multiple organizations on single platform instance.

**Decision:**
Implement multi-tenancy through `tenantId` foreign key on all scoped tables.

**Schema Pattern:**
```typescript
export const users = pgTable("users", {
  id: varchar("id").primaryKey(),
  tenantId: varchar("tenant_id").references(() => tenants.id),
  // ... other fields
});
```

**Tenant Assignment:**
- Users assigned to tenant based on email domain during signup
- Tenants have `allowedEmailDomains` array for validation
- Global users (consultants, admins) have `tenantId: null`

**Data Isolation:**
- All queries filtered by `tenantId` in storage layer
- Frontend `TenantContext` ensures correct tenant scope
- `TenantSwitcher` component for multi-tenant access

**Rationale:**
- Simpler than separate databases per tenant
- PostgreSQL row-level security can be added later
- Easier data aggregation across tenants (for analytics)
- Cost-effective scaling

**Consequences:**
- ✅ Single database to manage
- ✅ Cross-tenant reporting possible
- ✅ Easier backup/recovery
- ❌ Must be careful with query filtering (SQL injection risk if not using ORM)
- ❌ No physical data isolation (compliance consideration)

**Alternatives Considered:**
- Separate database per tenant (expensive, complex)
- Schema-per-tenant (better isolation, but migration complexity)

---

### ADR-004: Domain-Based Tenant Assignment

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Automatically assign users to correct organization on signup.

**Decision:**
Extract email domain and lookup tenant by `allowedEmailDomains` array.

**Implementation:**
```typescript
const domain = email.split('@')[1];
const tenant = await storage.getTenantByDomain(domain);
if (!tenant) {
  return res.status(403).json({ error: "No organization found for domain" });
}
```

**Rationale:**
- No manual tenant selection required
- Natural organizational boundary (email domains)
- Prevents users from joining wrong tenant
- Works for most business scenarios

**Consequences:**
- ✅ Automatic tenant assignment
- ✅ Reduced user friction
- ✅ Prevents cross-tenant pollution
- ❌ Requires tenant admin to pre-register domains
- ❌ Doesn't work for free email providers (gmail.com, yahoo.com)
- ❌ Consultants need special handling (multiple tenant access)

**Future Enhancement:**
- Auto-create trial tenant for unregistered domains (see BACKLOG.md - Entra SSO)

---

## Database & Schema

### ADR-005: PostgreSQL with Drizzle ORM

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need type-safe database access with good developer experience.

**Decision:**
Use PostgreSQL (Neon) with Drizzle ORM for database access.

**Rationale:**
- **PostgreSQL:** Industry standard, reliable, feature-rich (JSONB, full-text search, etc.)
- **Neon:** Serverless PostgreSQL, auto-scaling, built-in on Replit
- **Drizzle:** TypeScript-first ORM, excellent type inference, simple migrations

**Consequences:**
- ✅ Type-safe queries (compile-time error checking)
- ✅ Automatic TypeScript types from schema
- ✅ Simple schema migrations (`npm run db:push`)
- ✅ No lock-in (Drizzle generates standard SQL)
- ❌ Smaller ecosystem than Prisma or TypeORM
- ❌ Less documentation/community resources

**Alternatives Considered:**
- Prisma (larger, slower, more magic)
- TypeORM (decorator-based, less type-safe)
- Kysely (query builder only, no schema management)

---

### ADR-006: UUID Primary Keys

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need globally unique identifiers for distributed system.

**Decision:**
Use PostgreSQL `gen_random_uuid()` for all primary keys.

**Schema Pattern:**
```typescript
id: varchar("id").primaryKey().default(sql`gen_random_uuid()`)
```

**Rationale:**
- Globally unique (no collisions across environments)
- Non-sequential (security benefit - can't guess next ID)
- Works well for distributed systems
- No auto-increment coordination needed
- Easier data merging/imports

**Consequences:**
- ✅ Globally unique IDs
- ✅ Better security (non-sequential)
- ✅ Easier multi-environment sync
- ❌ Larger index size (36 chars vs 4-8 bytes)
- ❌ Less human-readable
- ❌ Slightly slower joins (but negligible with proper indexing)

**Note:** Stored as `varchar` not `uuid` type for Drizzle compatibility.

---

### ADR-007: JSONB for Array Fields

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need to store dynamic arrays (e.g., `linkedStrategies`, `allowedEmailDomains`).

**Decision:**
Use PostgreSQL `jsonb` type for array columns.

**Schema Pattern:**
```typescript
linkedStrategies: jsonb("linked_strategies").$type<string[]>()
```

**Rationale:**
- Native PostgreSQL support for JSON operations
- Indexable (GIN indexes)
- Flexible schema (can add nested objects later)
- Type-safe in TypeScript via `.$type<T>()`

**Consequences:**
- ✅ Flexible data structure
- ✅ Queryable with PostgreSQL JSON operators
- ✅ No junction table needed
- ❌ Less normalized (violates 1NF)
- ❌ Referential integrity not enforced (no FK constraints on array elements)
- ❌ Potential data duplication

**Trade-offs Accepted:**
- Denormalization acceptable for many-to-many relationships with low cardinality
- Performance benefit (no joins) outweighs normalization purity
- Can migrate to junction tables later if needed

**Alternatives Considered:**
- Junction tables (more normalized, but more complex queries)
- PostgreSQL array type (less flexible, harder to query)

---

## Frontend Architecture

### ADR-008: React + TypeScript + Wouter

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need modern, type-safe frontend with simple routing.

**Decision:**
Use React with TypeScript and Wouter for client-side routing.

**Tech Stack:**
- **React 18:** Component-based UI, hooks, concurrent features
- **TypeScript:** Type safety, better IDE support
- **Wouter:** Minimalist routing (~1KB vs 16KB for React Router)
- **Vite:** Fast dev server, optimized builds

**Rationale:**
- React is industry standard, large ecosystem
- TypeScript catches bugs at compile time
- Wouter is lightweight, simple API, no bloat
- Vite provides instant HMR, fast builds

**Consequences:**
- ✅ Type-safe components
- ✅ Fast development experience
- ✅ Small bundle size
- ❌ Wouter has fewer features than React Router (no nested routes, data loading)
- ❌ Less community support for Wouter

---

### ADR-009: TanStack Query for State Management

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need efficient server state management with caching.

**Decision:**
Use TanStack Query (React Query) for server state instead of Redux/Zustand.

**Pattern:**
```typescript
const { data, isLoading } = useQuery({
  queryKey: ['/api/okr/objectives'],
});

const mutation = useMutation({
  mutationFn: (data) => apiRequest('POST', '/api/okr/objectives', data),
  onSuccess: () => queryClient.invalidateQueries({ queryKey: ['/api/okr/objectives'] }),
});
```

**Rationale:**
- Designed specifically for server state (fetching, caching, updating)
- Automatic background refetching
- Built-in loading/error states
- Optimistic updates
- Cache invalidation patterns

**Consequences:**
- ✅ Less boilerplate than Redux
- ✅ Automatic caching and deduplication
- ✅ Built-in loading states
- ✅ Powerful devtools
- ❌ Learning curve for complex invalidation patterns
- ❌ Can over-fetch if not carefully structured

**Pattern Decisions:**
- Use hierarchical query keys: `['/api/recipes', id]` not `['/api/recipes/${id}']`
- Always invalidate cache after mutations
- Use `queryClient.invalidateQueries()` not `refetch()`

---

### ADR-010: Shadcn/UI Component Library

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need consistent, accessible UI components.

**Decision:**
Use shadcn/ui (Radix UI primitives) instead of Material-UI or Chakra.

**Rationale:**
- Copy-paste components (full control, no package dependency)
- Built on Radix UI (accessible, unstyled primitives)
- TailwindCSS styling (consistent with design system)
- Highly customizable
- No runtime cost (components are local)

**Consequences:**
- ✅ Full design control
- ✅ No version conflicts
- ✅ Smaller bundle size
- ✅ Easy to customize
- ❌ Manual updates (no `npm update`)
- ❌ More files in codebase

---

## Integration Decisions

### ADR-011: SendGrid for Transactional Email

**Date:** Initial implementation  
**Status:** Accepted  
**Context:** Need reliable email delivery for verification and password reset.

**Decision:**
Use SendGrid via Replit connector for transactional emails.

**Rationale:**
- Replit native integration (automatic secret management)
- Reliable delivery (99.9% uptime SLA)
- Email analytics and tracking
- Professional templates
- Free tier for development

**Consequences:**
- ✅ Reliable email delivery
- ✅ Professional appearance
- ✅ Analytics and monitoring
- ❌ SendGrid outage affects auth flows
- ❌ Cost scales with email volume

**Alternatives Considered:**
- AWS SES (more complex setup)
- Mailgun (similar pricing)
- SMTP (unreliable deliverability)

---

### ADR-012: OpenAI via Replit Connector (Planned)

**Date:** Planned (not yet implemented)  
**Status:** Proposed  
**Context:** AI-powered assistance features in backlog.

**Decision:**
Use OpenAI API via Replit's AI Integrations connector.

**Rationale:**
- Replit handles API key management
- Built-in usage monitoring
- Easy to integrate
- GPT-4 access for high-quality outputs

**Implementation Plan:**
- Use for AI chat, content generation, suggestions
- Culture-grounded prompts (inject company values/mission)
- Human-in-the-loop controls

**See:** BACKLOG.md High Priority #5

---

## Planned Decisions (Future ADRs)

### ADR-013: Microsoft Entra SSO Architecture (DRAFT)

**Status:** Draft (see BACKLOG.md #2)  
**Key Decisions:**
- Multi-tenant app registration in Synozur Entra tenant
- Dual authentication (email/password + SSO)
- Auto-provision trial tenants for unregistered domains
- Encrypted refresh token storage for Graph API access
- Hybrid delegated/application permissions model

**Full Details:** See BACKLOG.md High Priority #2

---

### ADR-014: RBAC Enforcement Strategy (DRAFT)

**Status:** Draft (see BACKLOG.md #1)  
**Key Decisions:**
- Middleware-based permission checking
- Permission matrix by role
- Tenant-level isolation enforcement
- UI hiding for unauthorized features

**Full Details:** See BACKLOG.md High Priority #1

---

## Decision Review Process

Technical decisions should be reviewed:
- **Quarterly:** Assess if decisions still hold
- **On major changes:** Re-evaluate when requirements shift
- **When better options emerge:** Consider migration paths

## ADR Template

Use this template for new decisions:

```markdown
### ADR-XXX: [Title]

**Date:** YYYY-MM-DD  
**Status:** Proposed | Accepted | Deprecated | Superseded  
**Context:** What problem are we solving?

**Decision:** What did we decide to do?

**Rationale:** Why did we make this decision?

**Consequences:**
- ✅ Positive outcomes
- ❌ Negative trade-offs
- ⚠️ Risks

**Alternatives Considered:**
- Option A: Why rejected
- Option B: Why rejected
```
