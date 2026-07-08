---
name: npm audit fix caveats
description: How to interpret npm audit "fixAvailable" suggestions before applying them, especially for transitive deps of already-current packages.
---

`npm audit fix --force` computes the *nearest version that resolves the advisory in npm's dependency graph*, not necessarily the "correct" or safe upgrade. Two patterns to watch for:

1. **Suggested downgrades**: if a direct dependency is already on its latest stable release (check `npm view <pkg> dist-tags`) but audit still proposes installing an *older* major version to fix a vulnerability in one of its own transitive deps (e.g. `@google-cloud/storage` -> older `5.x` to "fix" a `uuid` issue nested in its `gaxios`/`teeny-request` chain), that's a sign there is no real fix available yet — the vulnerable transitive version is baked into every release of the direct package. Don't apply the downgrade; leave it as an accepted residual risk and verify severity/exploitability instead.

2. **Dev-only tool vulnerabilities**: `esbuild`/`@esbuild-kit` advisories nested inside `drizzle-kit`'s own dependency tree (not the project's `vite`/`esbuild`) usually can't be fixed without a `drizzle-kit` release; audit may suggest an old `drizzle-kit` (a downgrade) — same rule applies, skip it.

**How to apply:** Before trusting any `fixAvailable` entry with `isSemVerMajor: true`, run `npm view <pkg> dist-tags` to confirm whether the proposed version is actually newer than current. If it's an older version than what's installed, it is very likely not a real fix — verify by checking `npm ls <vulnerable-transitive-pkg> --all` to see which direct dependency owns that subtree.

Also: after any major-version bump on a security-sensitive dependency (e.g. `@azure/msal-node`, `drizzle-orm`), compare `npm run check` (tsc) error counts before/after — if the count and file list are identical, the bump introduced no new type errors even though the API surface changed.
