/**
 * Tests for the sensitive-path guard (server/middleware/sensitivePathGuard.ts).
 *
 * Run with:
 *   npx tsx server/__tests__/sensitivePathGuard.test.ts
 *
 * These tests import and exercise the EXACT production middleware that
 * server/index.ts installs via `app.use(sensitivePathGuard)`.  Changing or
 * removing patterns in the production module will cause the corresponding
 * tests here to fail, providing real regression protection.
 *
 * Coverage:
 *   Each entry in SENSITIVE_PATH_RE must return HTTP 404 for probe paths.
 *
 *   Blocked paths tested:
 *     Dot-files / VCS   : /.env, /.env.local, /.env.production, /.git/,
 *                         /.git/config, /.gitignore, /.htaccess, /.DS_Store,
 *                         /.svn/, /.svn/entries
 *     CMS / PHP configs : /wp-config.php, /config.php, /configuration.php,
 *                         /wp-login.php, /wp-admin/, /wp-admin/admin.php,
 *                         /xmlrpc.php, /administrator/, /admin.php
 *     Server internals  : /server-status, /server-info
 *     Common backups    : /backup/, /backup/db.tar.gz, /db.sql, /dump.sql
 *
 *   Safe paths (must NOT be blocked):
 *     /, /api/health, /login, /assets/style.css, /favicon.ico,
 *     /environment, /backup-policy
 */

import express from "express";
import { createServer } from "http";
import type { AddressInfo } from "net";

// Import the PRODUCTION guard — the same function server/index.ts installs.
// Any change to that module (adding/removing patterns, rewriting the handler)
// is immediately reflected here.
import { sensitivePathGuard } from "../middleware/sensitivePathGuard";

// ---------------------------------------------------------------------------
// Tiny assertion helper
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function expect(label: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log(`  PASS ${label}`);
    passed++;
  } else {
    console.error(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Minimal Express app — production middleware first, then a 200 catch-all
// ---------------------------------------------------------------------------
const app = express();
app.use(sensitivePathGuard);          // ← the real, production guard
app.use((_req, res) => res.status(200).send("ok"));

const server = createServer(app);
await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
const { port } = server.address() as AddressInfo;
const BASE = `http://127.0.0.1:${port}`;

// ---------------------------------------------------------------------------
// HTTP helper
// ---------------------------------------------------------------------------
async function get(path: string): Promise<number> {
  const res = await fetch(`${BASE}${path}`);
  return res.status;
}

// ---------------------------------------------------------------------------
// Blocked paths — each must return 404
// ---------------------------------------------------------------------------
console.log("\n[dot-files / VCS]");
for (const p of ["/.env", "/.env.local", "/.env.production", "/.env.backup"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[.git paths]");
for (const p of ["/.git/", "/.git/config", "/.git/HEAD", "/.git"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[other dot-files]");
for (const p of ["/.gitignore", "/.htaccess", "/.DS_Store"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[.svn paths]");
for (const p of ["/.svn/", "/.svn/entries", "/.svn"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[CMS / PHP config files]");
for (const p of [
  "/wp-config.php", "/WP-CONFIG.PHP", "/config.php",
  "/configuration.php", "/admin.php", "/xmlrpc.php", "/wp-login.php",
]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[CMS admin directories]");
for (const p of [
  "/wp-admin/", "/wp-admin/admin-ajax.php", "/WP-ADMIN/",
  "/administrator/", "/administrator/index.php",
]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[server internals]");
for (const p of ["/server-status", "/server-info", "/SERVER-STATUS", "/Server-Info"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[backup paths]");
for (const p of ["/backup/", "/backup/db.tar.gz", "/BACKUP/"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

console.log("\n[SQL dump files]");
for (const p of ["/db.sql", "/dump.sql", "/DB.SQL", "/DUMP.SQL"]) {
  const status = await get(p);
  expect(`GET ${p} → 404`, status === 404, `got ${status}`);
}

// ---------------------------------------------------------------------------
// Safe paths — must NOT be blocked (guard must call next())
// ---------------------------------------------------------------------------
console.log("\n[safe paths — must return 200]");
for (const p of [
  "/", "/api/health", "/login", "/assets/style.css",
  "/favicon.ico", "/about",
  "/environment",    // contains "env" but is not a dot-file
  "/backup-policy",  // starts with /backup but is not /backup/ or /backup<file>
]) {
  const status = await get(p);
  expect(`GET ${p} → 200 (not blocked)`, status === 200, `got ${status}`);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
server.close();
const total = passed + failed;
console.log(`\n${passed}/${total} sensitive-path guard tests passed.`);
if (failed > 0) {
  console.error(`\n${failed} test(s) FAILED.`);
  process.exit(1);
}
console.log("\nAll sensitive-path guard tests passed.");
