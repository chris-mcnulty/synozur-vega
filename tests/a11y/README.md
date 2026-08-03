# Accessibility smoke tests

Automated [axe-core](https://github.com/dequelabs/axe-core) scans backing the
Section 508 / WCAG 2.1 AA remediation (see `BACKLOG.md` Feature #6 and
`docs/accessibility/VPAT.md`).

## Running

```bash
# Build the client, serve it statically, and scan the public routes:
npm run test:a11y

# Or scan an already-running instance (dev server, deployed preview, etc.):
A11Y_BASE_URL=http://localhost:5000 npm run test:a11y
```

The default flow uses `vite preview` (SPA fallback, no backend/DB needed), so it
covers the public, no-auth routes only: `/`, `/pricing`, `/login`.

## Adding authenticated routes

Authenticated routes (Dashboard, OKRs, Focus Rhythm, etc.) require a seeded
session. Point `A11Y_BASE_URL` at a running instance with a logged-in
[storage state](https://playwright.dev/docs/auth) and add specs that reuse that
state. This is wired in Phase 4 of the remediation once a CI-friendly test
fixture (seed user + tenant) is available.
