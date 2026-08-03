import { defineConfig, devices } from "@playwright/test";

// Accessibility smoke tests (axe-core) for the Section 508 / WCAG 2.1 AA
// remediation tracked in BACKLOG.md (Feature #6).
//
// The suite scans the public, no-auth routes against the built client served
// by `vite preview` (SPA fallback, no backend/DB required). Authenticated
// routes require a seeded session and are added once a CI-friendly test
// fixture exists (see tests/a11y/README.md).
const PORT = 4173;
const baseURL = process.env.A11Y_BASE_URL || `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./tests/a11y",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Allow pointing at a pre-installed Chromium (e.g. sandboxed CI images
        // that ship their own binary) instead of downloading one.
        ...(process.env.A11Y_CHROMIUM_PATH
          ? { launchOptions: { executablePath: process.env.A11Y_CHROMIUM_PATH } }
          : {}),
      },
    },
  ],
  // When A11Y_BASE_URL points at an already-running instance, skip the built-in
  // server. Otherwise build the client and serve it statically for the run.
  webServer: process.env.A11Y_BASE_URL
    ? undefined
    : {
        command: `npx vite build && npx vite preview --port ${PORT} --strictPort`,
        url: baseURL,
        reuseExistingServer: !process.env.CI,
        timeout: 180_000,
      },
});
