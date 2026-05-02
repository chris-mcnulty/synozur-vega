import { backfillSnapshotsFromCheckIns } from "../server/services/progress-snapshots";
(async () => {
  const r = await backfillSnapshotsFromCheckIns({ force: true });
  console.log("ok=" + r.ok + " inserted=" + r.inserted + " failures=" + (r.failures?.length ?? 0));
  if (r.failures?.length) console.log(JSON.stringify(r.failures.slice(0,3), null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
