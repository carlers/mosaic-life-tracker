# Session checkpoint

Updated: 2026-10-06
Current task: Remove the TodoMate task-cloud-sync throughput floor on `chatgpt/todomate-task-sync-server-batch`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Live use showed the exact-task progress counter works but the cloud phase is still far too slow. Root cause is the prior "safe parallel" implementation itself: four browser workers were globally paced 510 ms between fresh `createRow` starts, which imposes an absolute ~257-second / 4m17s minimum for 505 tasks even with zero network latency. The repair routes each pristine TodoMate RxDB push batch (20 rows) through one authenticated execution of the existing `message-action` Function. A new `bulk_create_todomate_tasks` handler validates the complete payload first, requires TodoMate source/caller ownership/non-deleted/no-reaction state, applies owner-only row permissions, and concurrently issues API-key server `createRow` calls. Appwrite server integrations are not subject to browser client rate limits. Same-owner 409 rows are returned to the client and reuse the existing bootstrap/conflict winner logic; a genuinely newer imported row falls back to the established single-row update path. General task sync is unchanged. The shared Function execution wrapper was extracted to `src/lib/appAction.ts` so task replication and messaging do not duplicate the Function call/timeout/error parser. An older deployed Function returning `Unknown action` falls back to the prior paced browser lane, making frontend/backend rollout ordering safe.
Next action: Finish regression/docs review, commit one coherent task checkpoint, run focused verification, and fix any failures. Because this changes Function source, prove the exact Function build/deployment on the disposable scratch Appwrite project if available. Preflight production bundle size before stable merge because the current aggregate gzip headroom is only ~655 B. After focused/scratch acceptance, squash into `perf/todomate-import-sync-audit` for one full canonical/Vercel pass. Production Function deployment/activation remains an explicit rollout step and must not be performed without user authorization; until activation, live production-backed Preview will intentionally use the old compatibility fallback.
Blockers: None.

## Performance finding

- Previous floor for 505 fresh tasks: `(505 - 1) × 510 ms ≈ 257 s` before request latency.
- New normal path: about 26 synchronous Function executions at the existing RxDB batch size of 20; each Function handles its row creates concurrently with server credentials.
- This task does not claim an exact final wall time until a real 505-task import is timed after Function activation.

## Verification target

- A pristine multi-row TodoMate RxDB push makes one Function execution and zero browser `createRow` calls.
- Old Function `Unknown action` falls back to the prior bounded/paced browser lane.
- Same-owner existing rows returned by the Function keep normal bootstrap/conflict semantics.
- Function rejects owner spoofing/invalid batches before writes, assigns only owner read/update/delete permissions, creates valid rows concurrently, and fails closed on foreign-owner ID collision.
- Ordinary task pushes, pending images, reactions, tombstones, account isolation, and exact task-progress counting remain unchanged.
- Production bundle-size growth is measured before stable acceptance; no repeated byte-golf cycles.
- Production Function is not activated without explicit user approval.

## Working files

- `src/lib/appAction.ts`
- `src/lib/messageDelivery.ts`
- `src/db/taskReplicationPilot.ts`
- `appwrite-functions/message-action/main.js`
- `appwrite-functions/message-action/todomate-task-batch.js`
- `tests/unit/taskReplicationPilot.test.ts`
- `tests/handlers/todomateTaskBatch.test.ts`
- `docs/TODOMATE_IMPORT.md`
- `docs/SYNC_SCENARIO_MATRIX.md`
- `docs/PROJECT_REFERENCE.md`
