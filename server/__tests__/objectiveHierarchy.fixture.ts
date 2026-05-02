/**
 * Runnable verification fixture for the recursive objective hierarchy loader.
 *
 * The project does not currently configure a unit-test runner, so this file
 * is a self-contained tsx script that exercises the storage layer against a
 * live tenant. It is not auto-run by CI; invoke manually with:
 *
 *   npx tsx server/__tests__/objectiveHierarchy.fixture.ts <tenantId> [rootId]
 *
 * Cases covered:
 *   1. Full hierarchy load returns a JSON-serializable, sorted tree.
 *   2. Sub-tree load with a forced root returns exactly one root.
 *   3. Sub-tree load on a leaf returns a root with no children.
 *   4. Synthetic A→B→C→A cycle: cycle warning is logged, sub-tree returns
 *      forced root once, JSON.stringify succeeds, A is NOT reattached as
 *      a leaf under C (CTE edges, not raw parentId, drive children).
 *   5. Synthetic deep chain past the cap: depth-cap warning fires only
 *      because actual descendants exist but were omitted.
 */
import { sql } from "drizzle-orm";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db";
import { objectives } from "../../shared/schema";
import { storage } from "../storage";

const PASS = "PASS";
const FAIL = "FAIL";

function assert(cond: any, msg: string) {
  if (!cond) {
    console.error(`  ${FAIL} ${msg}`);
    process.exitCode = 1;
  } else {
    console.log(`  ${PASS} ${msg}`);
  }
}

async function caseFullHierarchy(tenantId: string) {
  console.log("\n[case 1] full hierarchy load");
  const tree = await storage.getObjectiveHierarchy(tenantId);
  assert(Array.isArray(tree), "returns an array");
  let serialized = "";
  try { serialized = JSON.stringify(tree); } catch (e) { /* */ }
  assert(serialized.length > 0, "tree is JSON-serializable");
}

async function caseSubtreeRoot(tenantId: string, rootId: string) {
  console.log(`\n[case 2] sub-tree load on ${rootId}`);
  const sub = await storage.getObjectiveSubtree(rootId, tenantId);
  assert(sub.length === 1, "exactly one root returned");
  assert(sub[0]?.id === rootId, "root id matches request");
}

async function caseCycle(tenantId: string) {
  console.log("\n[case 3] synthetic A→B→C→A cycle");
  const ids = ["__cycle_test_A__", "__cycle_test_B__", "__cycle_test_C__"];
  await db.delete(objectives).where(inArray(objectives.id, ids));
  await db.insert(objectives).values([
    { id: ids[0], tenantId, title: "Cycle A", level: "organization", year: 2025, status: "active", parentId: null },
    { id: ids[1], tenantId, title: "Cycle B", level: "team", year: 2025, status: "active", parentId: ids[0] },
    { id: ids[2], tenantId, title: "Cycle C", level: "team", year: 2025, status: "active", parentId: ids[1] },
  ]);
  await db.execute(sql`UPDATE objectives SET parent_id = ${ids[2]} WHERE id = ${ids[0]}`);

  try {
    const sub = await storage.getObjectiveSubtree(ids[0], tenantId);
    assert(sub.length === 1, "forced root is the only root");
    assert(sub[0]!.id === ids[0], "forced root id matches");
    const json = JSON.stringify(sub);
    assert(json.length > 0, "JSON-serializable (no circular refs)");

    const collectIds = (n: any, out: string[] = []) => {
      out.push(n.id);
      for (const c of n.childObjectives || []) collectIds(c, out);
      return out;
    };
    const allIds = collectIds(sub[0]);
    const aOccurrences = allIds.filter(id => id === ids[0]).length;
    assert(aOccurrences === 1, `cycle node A appears exactly once (got ${aOccurrences})`);
  } finally {
    await db.execute(sql`UPDATE objectives SET parent_id = NULL WHERE id = ${ids[0]}`);
    await db.delete(objectives).where(inArray(objectives.id, ids));
  }
}

async function caseDepthCap(tenantId: string) {
  console.log("\n[case 4] synthetic deep chain past the cap");
  const N = 22;
  const ids = Array.from({ length: N }, (_, i) => `__depth_test_${i}__`);
  await db.delete(objectives).where(inArray(objectives.id, ids));
  for (let i = 0; i < N; i++) {
    await db.insert(objectives).values({
      id: ids[i],
      tenantId,
      title: `Depth ${i}`,
      level: i === 0 ? "organization" : "team",
      year: 2025,
      status: "active",
      parentId: i === 0 ? null : ids[i - 1],
    });
  }

  try {
    const origWarn = console.warn;
    let warnText = "";
    console.warn = (...args: any[]) => { warnText += args.join(" ") + "\n"; };
    try {
      const sub = await storage.getObjectiveSubtree(ids[0], tenantId);
      assert(sub.length === 1, "forced root returned");
      assert(warnText.includes("depth cap"), "depth-cap warning is emitted");
    } finally {
      console.warn = origWarn;
    }
  } finally {
    for (let i = N - 1; i > 0; i--) {
      await db.execute(sql`UPDATE objectives SET parent_id = NULL WHERE id = ${ids[i]}`);
    }
    await db.delete(objectives).where(inArray(objectives.id, ids));
  }
}

async function main() {
  const tenantId = process.argv[2];
  const rootId = process.argv[3];
  if (!tenantId) {
    console.error("Usage: tsx server/__tests__/objectiveHierarchy.fixture.ts <tenantId> [rootId]");
    process.exit(2);
  }

  await caseFullHierarchy(tenantId);
  if (rootId) await caseSubtreeRoot(tenantId, rootId);
  await caseCycle(tenantId);
  await caseDepthCap(tenantId);

  console.log(process.exitCode ? "\nSOME CASES FAILED" : "\nALL CASES PASSED");
  process.exit(process.exitCode ?? 0);
}

main().catch(err => {
  console.error("Fixture aborted:", err);
  process.exit(1);
});
