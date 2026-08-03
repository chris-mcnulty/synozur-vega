# Claude Code — Standing Instructions for synozur-vega

## Read these files before writing any code

1. `/home/user/synozur-vega/replit.md` — architecture, system design decisions, multi-tenancy rules, auth patterns, external integrations
2. `/home/user/synozur-vega/BACKLOG.md` — the single source of truth for all feature specs, implementation plans, and backlog items

Do not create any new planning, backlog, or spec documents. All feature work is tracked in `/home/user/synozur-vega/BACKLOG.md`.

## Multi-tenancy (non-negotiable)

This is a multi-tenant SaaS platform. Every data access must be tenant-scoped.

- Every TanStack Query key that fetches tenant data must include `tenantId`: `["/api/okr/objectives", tenantId, quarter, year]`
- Every API call must include `tenantId` in the request params or body
- Every cache invalidation must include `tenantId` in the query key — never invalidate a bare key like `["/api/okr/objectives"]` without tenant scope unless intentional and explicitly justified
- Never use a fallback empty string for `tenantId` (e.g. `tenantId ?? ""`). If `tenantId` is missing, the operation should not proceed

## General development rules

- Read and understand existing code before modifying it
- Do not create new files when editing an existing one will do
- Do not add features, refactoring, or comments beyond what was asked
- Match the patterns already used in the file being edited

## Pull request handling (standing policy)

Owner's explicit instruction — this OVERRIDES the default "be frugal with GitHub comments" guidance:

- **Subscribe to every pull request** you open or are asked to work on (`subscribe_pr_activity`); stay subscribed until it is merged or closed.
- **Address every review comment** — investigate each one and either fix it, or reply explaining why no change is made (e.g. pre-existing / out of scope).
- **Attach a reply to every comment you fix**, for tracking — note the fixing commit SHA in the reply. Reply on each comment individually rather than a single summary.
