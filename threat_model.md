# Threat Model

## Project Overview

Vega is a multi-tenant Company OS web application built with a React frontend, an Express/Node backend, and PostgreSQL via Drizzle. It serves tenant users, tenant admins, internal staff, consultants, Galaxy portal users, and machine clients through browser sessions, Entra SSO, Galaxy JWT trust, embeddable public cards, and MCP/OAuth APIs. The app is publicly deployed, so production-facing unauthenticated and authenticated routes are in scope; development-only artifacts are not.

## Assets

- **Tenant business data** — objectives, key results, big rocks, meetings, check-ins, reports, launchpad sessions, notifications, support tickets, and exports. Cross-tenant disclosure or tampering would break the platform’s core isolation guarantee.
- **User accounts and session state** — local credentials, password-reset tokens, verification tokens, session cookies, Entra-linked identities, and Galaxy JIT-provisioned identities. Compromise enables impersonation and tenant access.
- **Machine credentials and delegated access** — MCP API keys, OAuth clients, OAuth refresh tokens, Galaxy trust settings, and Microsoft integration tokens. Abuse could expose tenant data outside the browser experience.
- **Public share artifacts** — embed tokens and rendered embed content. These are intentionally public-by-link and must remain limited to the specific tenant artifact each token grants.
- **Operational secrets and integrations** — session secrets, JWT signing secrets, SendGrid, Microsoft, AI-provider, and HubSpot credentials. Leakage or weak handling could allow impersonation or unauthorized API actions.
- **Audit and security telemetry** — portal audit logs, MCP audit logs, embed access logs, reassignment audit logs. Integrity matters for incident response and abuse investigation.

## Trust Boundaries

- **Browser to Express API** — all client input is untrusted. Every authenticated route must validate both identity and tenant/resource authorization server-side.
- **Express to PostgreSQL** — storage access crosses from application logic to the authoritative data store. Any missing tenant predicate or ID-based lookup without authorization can become cross-tenant disclosure or modification.
- **Public internet to public routes** — `/api/health`, `/oauth/*`, `/mcp/*` token exchange, `/embed/v1/*`, and auth-related routes are reachable without a browser session. These must resist token abuse, enumeration, and public data leakage.
- **Galaxy portal to Vega** — external JWT assertions are trusted only after signature, issuer, audience/client mapping, and tenant binding validation.
- **Machine clients to MCP/OAuth** — API keys, OAuth tokens, and Entra JWTs must be scope-limited, tenant-bound, and protected against misuse from unexpected origins or IPs.
- **Server to third-party services** — Microsoft Graph, SendGrid, AI providers, HubSpot, and JWKS retrieval all involve outbound trust. User-controlled or tenant-controlled URLs must not become SSRF paths.
- **User to admin / internal roles** — tenant users, tenant admins, consultants, and platform admins have different powers. Role checks must be enforced on the server, not inferred from the client.
- **Production to dev-only code** — tests, local scripts, and build artifacts are out of scope unless a production route or workflow makes them reachable.

## Scan Anchors

- **Production entry points:** `server/index.ts`, `server/routes.ts`, `server/routes-*.ts`, `server/mcp/*`, `server/portal/*`
- **Highest-risk areas:** session/auth setup, tenant validation middleware, ID-based storage lookups in route handlers, reporting/export routes, MCP/OAuth, Galaxy portal trust, embed token rendering, import/webhook/integration routes
- **Public surfaces:** `/api/auth/*`, `/oauth/*`, `/mcp/*`, `/embed/v1/*`, Entra auth callbacks, password reset and verification flows
- **Authenticated surfaces:** most `/api/*` routes mounted with `requireAuth` / `authWithTenant`
- **Admin surfaces:** `/api/embed-tokens`, tenant admin and platform admin endpoints in `server/routes.ts`
- **Usually dev-only:** `dist/`, `node_modules/`, tests, one-off scripts under `scripts/` unless referenced by production paths

## Threat Categories

### Spoofing

Vega supports several identity models: local sessions, Microsoft Entra SSO, Galaxy portal JWTs, MCP API keys, and OAuth tokens. The system must ensure every protected route accepts only a valid, intended identity and binds that identity to the correct tenant. Session cookies must remain unforgeable, password-reset and verification tokens must be single-purpose and time-bounded, and external JWT trust must reject tokens with invalid signature, issuer, audience/client mapping, or tenant binding.

### Tampering

Users can update strategic data, meetings, reports, support artifacts, and portal check-ins. The server must derive authorization from the authenticated identity, not from client-supplied tenant IDs or object IDs alone. Machine and portal write paths must enforce both role/scope and tenant/resource ownership before mutating records.

### Information Disclosure

The biggest project-specific risk is cross-tenant leakage through object-by-ID lookups, exports, reports, embeds, search, support records, or machine APIs. Every response that includes tenant data must verify that the requested resource belongs to the requester’s allowed tenant and, where applicable, to the requester’s owned scope. Public embed links must disclose only the single artifact represented by a valid token. Error responses and logs must avoid exposing secrets, tokens, or sensitive tenant content.

### Denial of Service

Public or machine-facing routes such as login, password reset, portal JWT endpoints, MCP token exchange, and heavy export/report generation can be abused for resource exhaustion. The system must rate-limit public and delegated-auth surfaces, bound expensive operations, and avoid untrusted inputs that trigger large fan-out queries or document generation for unauthorized users.

### Elevation of Privilege

The main privilege-escalation risks are broken tenant isolation, missing per-resource authorization checks after authentication, role-confusion between tenant and platform roles, and over-broad machine scopes. The system must guarantee that user, consultant, portal, and machine identities can access only the tenant data and actions explicitly granted to them, and that public or semi-public tokens cannot be turned into broader platform access.
