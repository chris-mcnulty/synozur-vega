import { backfillSnapshotsFromCheckIns } from "./server/services/progress-snapshots";
(async () => {
  const r = await backfillSnapshotsFromCheckIns({ force: false });
  console.log(JSON.stringify(r, null, 2));
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
