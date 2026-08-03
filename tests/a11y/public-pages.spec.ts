import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// Public, no-authentication routes. These render client-side without a backend,
// so they can be scanned against a static `vite preview` build.
const PUBLIC_ROUTES = [
  { path: "/", name: "Landing" },
  { path: "/pricing", name: "Pricing" },
  { path: "/login", name: "Login" },
];

// Target the conformance level this product claims (see docs/accessibility/VPAT.md).
const WCAG_TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"];

for (const route of PUBLIC_ROUTES) {
  test(`${route.name} (${route.path}) has no WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: "networkidle" });

    const results = await new AxeBuilder({ page })
      .withTags(WCAG_TAGS)
      .analyze();

    // Attach the full report so CI surfaces exactly which nodes fail.
    const summary = results.violations.map((v) => ({
      id: v.id,
      impact: v.impact,
      help: v.help,
      nodes: v.nodes.length,
    }));
    await test.info().attach(`axe-${route.name}.json`, {
      body: JSON.stringify(summary, null, 2),
      contentType: "application/json",
    });

    expect(results.violations, JSON.stringify(summary, null, 2)).toEqual([]);
  });
}
