# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate final cloud-sync progress and throughput on `chatgpt/todomate-task-sync-progress`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Live acceptance confirms the repaired import now completes its local/restore work much faster; the remaining user-visible bottleneck is the last task-to-Appwrite convergence phase. This task adds an exact TodoMate task counter backed by RxDB's successful `sent$` stream, so the sheet can show e.g. `Syncing tasks to cloud (54/505)…`. For fresh side-effect-free TodoMate batches only, the task push handler uses up to four workers to overlap request latency while create starts are serialized about 510 ms apart (~117.6/min), below Appwrite's documented 120 create-row requests/minute per IP+method+URL+user. All mixed/general task batches keep the current serial path and every worker still reuses the existing single-row create/conflict/bootstrap logic. Appwrite browser clients do not expose server bulk-row methods, so no unsupported client bulk shortcut is introduced.
Next action: Commit the implementation, regression tests, sync matrix, TodoMate contract, and this checkpoint as one focused task commit. Run focused verification and fix any failures. If green, squash-merge into `perf/todomate-import-sync-audit`, require the full canonical gate plus Vercel/build-size acceptance, then have the user time the real 505-task final sync and confirm the live counter advances accurately. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- TodoMate import UI visibly renders exact task cloud progress such as `54/505`.
- Progress counts unique successful target-task sends from the active RxDB replication and ignores duplicate/non-target sends.
- Fresh side-effect-free TodoMate batches overlap request latency with at most four workers.
- Appwrite create starts are spaced at least 510 ms apart, preserving headroom under the 120/min client create-row limit.
- Existing 409 bootstrap fallback, ownership validation, pending-image handling, reaction preservation, generic task pushes, large-import/idempotence, and sync-pending behavior remain green.
- Stable production bundle remains within the reviewed build-size policy; if intended feature growth exceeds the existing ceiling after measured cleanup, any limit change must be explicitly documented rather than made only to silence CI.

## Working files

- `src/db/taskReplicationPilot.ts`
- `src/lib/restoreData.ts`
- `tests/unit/taskReplicationPilot.test.ts`
- `tests/unit/restoreData.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `docs/TODOMATE_IMPORT.md`
- `docs/SYNC_SCENARIO_MATRIX.md`
