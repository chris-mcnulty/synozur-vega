/**
 * Self-contained automated tests for the recursive objective tree loader.
 *
 * The project does not configure a unit-test runner, so this file is a
 * runnable tsx script that seeds its own ephemeral tenant + objectives in
 * the configured database, exercises storage.getObjectiveHierarchy /
 * storage.getObjectiveSubtree (and indirectly loadObjectiveTreeRows /
 * assembleObjectiveTree), then tears the tenant down on success or failure.
 *
 * Run with:
 *
 *   DATABASE_URL=... npx tsx server/__tests__/objectiveTreeLoader.test.ts
 *
 * Cases covered:
 *   1. Full hierarchy load — shape, sort order, all root/child links via CTE.
 *   2. roots-with-filtered-out-parents — child stays as virtual root when its
 *      parent is filtered out (different year).
 *   3. Quarter / year / level / team filter combinations.
 *   4. Sub-tree mode returns exactly the descendants of the requested root.
 *   5. Alignment "virtual children" — only included when target is in the
 *      result set, and tagged with isAligned: true.
 *   6. Cycle protection — A→B→C→A is reported, traversal terminates,
 *      JSON-serializable, no node duplicated.
 *   7. Depth cap behavior — chains past OBJECTIVE_HIERARCHY_DEPTH_CAP emit a
 *      warning and the truncation point has no children attached.
 *   8. API response shape — the keys consumed by clients are stable.
 */
import { sql, eq, inArray } from "drizzle-orm";
import { db, pool } from "../db";
import { tenants, objectives, keyResults } from "../../shared/schema";
import { storage } from "../storage";

const PASS = "PASS";
const FAIL = "FAIL";

let failed = 0;
function assert(cond: any, msg: string) {
  if (!cond) {
    console.error(`  ${FAIL} ${msg}`);
    failed += 1;
    process.exitCode = 1;
  } else {
    console.log(`  ${PASS} ${msg}`);
  }
}

const TEST_TENANT_NAME = `__tree_loader_test_${Date.now()}__`;
let tenantId = "";

async function createTenant() {
  const [t] = await db.insert(tenants).values({ name: TEST_TENANT_NAME }).returning();
  tenantId = t.id;
}

async function destroyTenant() {
  if (!tenantId) return;
  // Objectives cascade-delete via tenant FK; key_results cascade via objective FK.
  await db.delete(tenants).where(eq(tenants.id, tenantId));
}

type SeedRow = {
  id: string;
  title: string;
  level: "organization" | "division" | "team" | "individual";
  parentId?: string | null;
  quarter?: number | null;
  year?: number;
  teamId?: string | null;
  alignedToObjectiveIds?: string[];
  status?: string;
};

async function seed(rows: SeedRow[]) {
  await db.insert(objectives).values(
    rows.map(r => ({
      id: r.id,
      tenantId,
      title: r.title,
      level: r.level,
      parentId: r.parentId ?? null,
      quarter: r.quarter ?? null,
      year: r.year ?? 2025,
      teamId: r.teamId ?? null,
      status: r.status ?? "active",
      alignedToObjectiveIds: r.alignedToObjectiveIds ?? null,
    } as any)),
  );
}

function findNode(tree: any[], id: string): any | null {
  for (const n of tree) {
    if (n.id === id) return n;
    const c = findNode(n.childObjectives || [], id);
    if (c) return c;
    const a = findNode(n.alignedObjectives || [], id);
    if (a) return a;
  }
  return null;
}

function collectIds(tree: any[]): string[] {
  const out: string[] = [];
  const walk = (n: any) => {
    out.push(n.id);
    for (const c of n.childObjectives || []) walk(c);
    for (const a of n.alignedObjectives || []) walk(a);
  };
  for (const r of tree) walk(r);
  return out;
}

// ---------------------------------------------------------------------------
// Cases
// ---------------------------------------------------------------------------

async function caseFullHierarchyShape() {
  console.log("\n[case 1] full hierarchy shape + sorting");
  // org
  //  ├── team-a (quarter 1, team-1)
  //  │     └── individual-a1
  //  └── team-b (quarter 2, team-2)
  await seed([
    { id: "h-org",  title: "1. Org", level: "organization", quarter: null, year: 2025 },
    { id: "h-tA",   title: "1.1 Team A", level: "team", parentId: "h-org", quarter: 1, year: 2025, teamId: "team-1" },
    { id: "h-iA1",  title: "1.1.1 Indiv A1", level: "individual", parentId: "h-tA", quarter: 1, year: 2025, teamId: "team-1" },
    { id: "h-tB",   title: "1.2 Team B", level: "team", parentId: "h-org", quarter: 2, year: 2025, teamId: "team-2" },
  ]);
  await db.insert(keyResults).values({
    id: "h-kr1",
    objectiveId: "h-org",
    tenantId,
    title: "1. KR one",
    metricType: "increase",
    targetValue: 100,
  } as any);

  const tree = await storage.getObjectiveHierarchy(tenantId);
  assert(Array.isArray(tree), "returns an array");
  assert(tree.length === 1 && tree[0].id === "h-org", "single root is the org objective");

  const root = tree[0];
  // API response shape (case 8).
  for (const key of [
    "id", "title", "level", "tenantId", "keyResults",
    "childObjectives", "alignedObjectives", "linkedBigRocks", "lastUpdated",
  ]) {
    assert(key in root, `root has expected key "${key}"`);
  }
  assert(Array.isArray(root.keyResults) && root.keyResults.length === 1, "key results loaded");
  assert(root.keyResults[0].id === "h-kr1", "key result id matches");

  assert(root.childObjectives.length === 2, "two team children");
  // Numeric prefix ordering: 1.1 before 1.2.
  assert(
    root.childObjectives[0].id === "h-tA" && root.childObjectives[1].id === "h-tB",
    "children sorted by numeric title prefix",
  );

  const tA = root.childObjectives[0];
  assert(tA.childObjectives.length === 1 && tA.childObjectives[0].id === "h-iA1", "individual nested under team A");
  assert(JSON.stringify(tree).length > 0, "tree is JSON-serializable");
}

async function caseFilteredParents() {
  console.log("\n[case 2] filtered parent → child becomes virtual root");
  // Parent is 2024, child is 2025. Querying year=2025 should surface the child as a virtual root.
  await seed([
    { id: "f-parent24", title: "Parent 2024", level: "organization", year: 2024, quarter: null },
    { id: "f-child25",  title: "Child 2025",  level: "team", parentId: "f-parent24", year: 2025, quarter: 1, teamId: "team-x" },
  ]);

  const tree = await storage.getObjectiveHierarchy(tenantId, undefined, 2025);
  const ids = tree.map(r => r.id);
  assert(ids.includes("f-child25"), "filtered-out parent → child appears as a root");
  assert(!ids.includes("f-parent24"), "out-of-filter parent is not surfaced");
  // Root nodes never re-attach to filtered-out parents.
  const child = tree.find(r => r.id === "f-child25");
  assert(child && (child.childObjectives?.length ?? 0) === 0, "virtual root has no spurious children");
}

async function caseFilters() {
  console.log("\n[case 3] quarter / year / level / team filter combinations");
  // Existing seed already has team-1 (Q1) and team-2 (Q2). Add a noise row in another year.
  await seed([
    { id: "fl-noise", title: "Noise 2030", level: "team", quarter: 1, year: 2030, teamId: "team-1" },
  ]);

  // year=2025 alone — drops 2024/2030 noise.
  const byYear = await storage.getObjectiveHierarchy(tenantId, undefined, 2025);
  const yIds = collectIds(byYear);
  assert(!yIds.includes("fl-noise"), "year filter excludes other years");
  assert(!yIds.includes("f-parent24"), "year filter excludes 2024 parent");

  // year=2025, quarter=1 — h-tB (Q2) is filtered out.
  const byQ = await storage.getObjectiveHierarchy(tenantId, 1, 2025);
  const qIds = collectIds(byQ);
  assert(qIds.includes("h-tA"), "quarter filter keeps Q1 row");
  assert(!qIds.includes("h-tB"), "quarter filter drops Q2 row");
  // Quarterless (h-org) is still visible because the loader treats NULL quarter as inheritable.
  assert(qIds.includes("h-org"), "quarterless objective still surfaces under quarter filter");

  // level=team — only team-level rows remain.
  const byLevel = await storage.getObjectiveHierarchy(tenantId, undefined, 2025, "team");
  const lIds = collectIds(byLevel);
  assert(lIds.every(id => id === "h-tA" || id === "h-tB" || id === "f-child25"),
    "level=team only surfaces team-level rows");
  assert(!lIds.includes("h-org"), "level=team excludes org objective");
  assert(!lIds.includes("h-iA1"), "level=team excludes individual-level row");

  // teamId=team-1 — drops team-2 row.
  const byTeam = await storage.getObjectiveHierarchy(tenantId, undefined, 2025, undefined, "team-1");
  const tIds = collectIds(byTeam);
  assert(tIds.includes("h-tA"), "teamId filter keeps team-1");
  assert(!tIds.includes("h-tB"), "teamId filter drops team-2");
}

async function caseSubtree() {
  console.log("\n[case 4] sub-tree mode");
  const sub = await storage.getObjectiveSubtree("h-tA", tenantId);
  assert(sub.length === 1 && sub[0].id === "h-tA", "exactly one forced root");
  assert(sub[0].childObjectives.length === 1 && sub[0].childObjectives[0].id === "h-iA1",
    "descendants attached under forced root");

  // Leaf sub-tree.
  const leaf = await storage.getObjectiveSubtree("h-iA1", tenantId);
  assert(leaf.length === 1 && leaf[0].childObjectives.length === 0, "leaf sub-tree has no children");

  // Sub-tree ignores quarter/year/level/team filters at the storage layer.
  const subB = await storage.getObjectiveSubtree("h-tB", tenantId);
  assert(subB.length === 1 && subB[0].id === "h-tB", "sub-tree returns Q2 root regardless of filters");
}

async function caseAlignment() {
  console.log("\n[case 5] alignment virtual children");
  // a-target is the alignment "parent"; a-source ladders up to it via alignedToObjectiveIds.
  // Both have no parent_id link.
  await seed([
    { id: "a-target", title: "Align target", level: "organization", year: 2025, quarter: null },
    { id: "a-source", title: "Align source", level: "team", year: 2025, quarter: 1, teamId: "team-a",
      alignedToObjectiveIds: ["a-target"] },
  ]);

  const tree = await storage.getObjectiveHierarchy(tenantId);
  const target = findNode(tree, "a-target");
  assert(target !== null, "alignment target appears in tree");
  assert(target.alignedObjectives.length === 1 && target.alignedObjectives[0].id === "a-source",
    "alignment source is attached as virtual child of target");
  assert(target.alignedObjectives[0].isAligned === true, "alignment source is flagged isAligned: true");

  // When the source is filtered out, no alignment edge surfaces.
  const filtered = await storage.getObjectiveHierarchy(tenantId, undefined, 2025, "organization");
  const targetFiltered = findNode(filtered, "a-target");
  assert(
    targetFiltered && targetFiltered.alignedObjectives.length === 0,
    "alignment edge dropped when source is outside the filter set",
  );
}

async function caseCycle() {
  console.log("\n[case 6] cycle protection (A→B→C→A)");
  const ids = ["c-A", "c-B", "c-C"];
  await seed([
    { id: ids[0], title: "Cycle A", level: "organization", year: 2025, quarter: null },
    { id: ids[1], title: "Cycle B", level: "team", year: 2025, quarter: 1, parentId: ids[0] },
    { id: ids[2], title: "Cycle C", level: "team", year: 2025, quarter: 1, parentId: ids[1] },
  ]);
  await db.execute(sql`UPDATE objectives SET parent_id = ${ids[2]} WHERE id = ${ids[0]}`);

  const origWarn = console.warn;
  let warnText = "";
  console.warn = (...args: any[]) => { warnText += args.join(" ") + "\n"; };
  try {
    const sub = await storage.getObjectiveSubtree(ids[0], tenantId);
    assert(sub.length === 1 && sub[0].id === ids[0], "forced root once");
    assert(JSON.stringify(sub).length > 0, "tree is JSON-serializable (no circular refs)");
    const seen = collectIds(sub);
    assert(seen.filter(id => id === ids[0]).length === 1, "cycle node A appears exactly once");
    assert(warnText.includes("cyclic parent_id"), "cycle warning emitted");
  } finally {
    console.warn = origWarn;
    // Break the cycle before teardown so tenant delete cascades cleanly.
    await db.execute(sql`UPDATE objectives SET parent_id = NULL WHERE id = ${ids[0]}`);
  }
}

async function caseDepthCap() {
  console.log("\n[case 7] depth cap");
  const N = 22; // > OBJECTIVE_HIERARCHY_DEPTH_CAP (20)
  const ids = Array.from({ length: N }, (_, i) => `d-${i}`);
  // Use one Drizzle insert per row so each FK to the previous id is satisfied.
  for (let i = 0; i < N; i++) {
    await db.insert(objectives).values({
      id: ids[i],
      tenantId,
      title: `Depth ${i}`,
      level: i === 0 ? "organization" : "team",
      year: 2025,
      quarter: null,
      status: "active",
      parentId: i === 0 ? null : ids[i - 1],
    } as any);
  }

  const origWarn = console.warn;
  let warnText = "";
  console.warn = (...args: any[]) => { warnText += args.join(" ") + "\n"; };
  try {
    const sub = await storage.getObjectiveSubtree(ids[0], tenantId);
    assert(sub.length === 1, "forced root returned at depth-cap chain");
    assert(warnText.includes("depth cap"), "depth-cap warning emitted");

    // Walk to the max-depth node and confirm it has no attached children
    // even though more rows exist below it in the DB.
    let cur = sub[0];
    let walked = 0;
    while (cur.childObjectives && cur.childObjectives.length > 0) {
      cur = cur.childObjectives[0];
      walked += 1;
      if (walked > 100) break; // safety
    }
    assert(walked <= 20, `traversal stopped at the depth cap (walked=${walked})`);
    assert(
      cur.childObjectives.length === 0,
      "node at the cap has no children attached even though descendants exist",
    );
  } finally {
    console.warn = origWarn;
    // Unwire the chain so cascade delete is cheap and ordered.
    for (let i = N - 1; i > 0; i--) {
      await db.execute(sql`UPDATE objectives SET parent_id = NULL WHERE id = ${ids[i]}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Entry
// ---------------------------------------------------------------------------

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is required to run the objective tree loader tests.");
    process.exit(2);
  }

  console.log(`Seeding ephemeral tenant "${TEST_TENANT_NAME}"`);
  await createTenant();

  try {
    await caseFullHierarchyShape();
    await caseFilteredParents();
    await caseFilters();
    await caseSubtree();
    await caseAlignment();
    await caseCycle();
    await caseDepthCap();
  } finally {
    await destroyTenant();
    await pool.end().catch(() => {});
  }

  if (failed > 0) {
    console.log(`\n${failed} assertion(s) failed`);
    process.exit(1);
  }
  console.log("\nALL CASES PASSED");
  process.exit(0);
}

main().catch(async err => {
  console.error("Test run aborted:", err);
  try { await destroyTenant(); } catch {}
  try { await pool.end(); } catch {}
  process.exit(1);
});
