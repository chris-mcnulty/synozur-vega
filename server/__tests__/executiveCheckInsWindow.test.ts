/**
 * Self-contained tests for executiveCheckInsWindows — the helper used by
 * /api/dashboard/context to bound the check-in history returned for the
 * executive scope. The project does not configure a unit-test runner, so
 * this file is a runnable tsx script.
 *
 * Run with:
 *
 *   npx tsx server/__tests__/executiveCheckInsWindow.test.ts
 *
 * Cases covered:
 *   1. No period -> single window from = now - 120d, no to.
 *   2. Current quarter -> two windows: period (open upper bound) and
 *      recent ([now-30d, +∞]).
 *   3. Historical quarter -> two windows: bounded period and the recent
 *      window so "this week / days since last check-in" still works.
 *   4. Future quarter -> two windows: future period (open upper bound)
 *      and the recent window so recent-activity widgets keep working
 *      even before the period starts.
 *   5. Annual historical view (quarter = 0) keeps both windows.
 */
import { __executiveCheckInsWindowsForTests as windows } from "../routes-dashboard";

let failed = 0;
function assert(cond: any, msg: string) {
  if (!cond) {
    console.error(`  FAIL ${msg}`);
    failed += 1;
  } else {
    console.log(`  PASS ${msg}`);
  }
}

const DAY = 24 * 60 * 60 * 1000;

function findRecentWindow(ws: Array<{ from?: Date; to?: Date }>) {
  // The recent window is the one whose `from` is roughly 30 days ago and has
  // no `to`.
  return ws.find(
    (w) =>
      w.to === undefined &&
      w.from !== undefined &&
      Math.abs(Date.now() - w.from.getTime() - 30 * DAY) < 2 * DAY,
  );
}

(function main() {
  console.log("executiveCheckInsWindows:");

  // 1. No period
  {
    const ws = windows(undefined, undefined);
    assert(ws.length === 1, "no period: single window");
    assert(ws[0].to === undefined, "no period: no upper bound");
    const ago = (Date.now() - ws[0].from!.getTime()) / DAY;
    assert(ago > 119 && ago < 121, `no period: lower bound ~120d ago (got ${ago.toFixed(1)})`);
  }

  // 2. Current quarter
  {
    const today = new Date();
    const q = Math.floor(today.getUTCMonth() / 3) + 1;
    const y = today.getUTCFullYear();
    const ws = windows(q, y);
    assert(ws.length === 2, "current quarter: two windows");
    const period = ws[0];
    assert(period.to === undefined, "current quarter period: open upper bound");
    assert(!!period.from && period.from.getTime() < Date.now(), "current quarter period: lower bound in past");
    assert(!!findRecentWindow(ws), "current quarter: includes recent window");
  }

  // 3. Historical quarter (regression: prior-quarter selection)
  {
    const ws = windows(3, 2024);
    assert(ws.length === 2, "historical: two windows");
    const period = ws[0];
    assert(!!period.to, "historical period: has upper bound");
    const expectedTo = Date.UTC(2024, 9, 30, 23, 59, 59);
    const toOff = Math.abs(period.to!.getTime() - expectedTo) / DAY;
    assert(toOff < 2, `historical period: upper bound near periodEnd+30d (off ${toOff.toFixed(1)}d)`);
    const expectedFrom = Date.UTC(2024, 5, 17);
    const fromOff = Math.abs(period.from!.getTime() - expectedFrom) / DAY;
    assert(fromOff < 2, `historical period: lower bound near periodStart-14d (off ${fromOff.toFixed(1)}d)`);
    assert(!!findRecentWindow(ws), "historical: still includes recent window for activity widgets");
  }

  // 4. Future quarter (regression: future-period selection)
  {
    const future = new Date();
    future.setUTCFullYear(future.getUTCFullYear() + 2);
    const ws = windows(1, future.getUTCFullYear());
    assert(ws.length === 2, "future: two windows");
    const period = ws[0];
    assert(period.to === undefined, "future period: open upper bound (period not over)");
    assert(!!period.from && period.from.getTime() > Date.now(), "future period: lower bound in future");
    assert(!!findRecentWindow(ws), "future: includes recent window so recent-activity widgets still work");
  }

  // 5. Annual historical view (quarter = 0)
  {
    const ws = windows(0, 2024);
    assert(ws.length === 2, "annual historical: two windows");
    const period = ws[0];
    assert(!!period.to, "annual historical period: has upper bound");
    const expectedTo = Date.UTC(2024, 11, 31, 23, 59, 59);
    const off = Math.abs(period.to!.getTime() - expectedTo) / DAY;
    assert(off < 32, `annual historical period: upper bound near year end + 30d (off ${off.toFixed(1)}d)`);
    assert(!!findRecentWindow(ws), "annual historical: includes recent window");
  }

  if (failed > 0) {
    console.error(`\n${failed} assertion(s) failed`);
    process.exit(1);
  } else {
    console.log("\nAll assertions passed");
  }
})();
