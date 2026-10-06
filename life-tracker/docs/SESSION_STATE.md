# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening, with final bundle-budget compaction on `chatgpt/todomate-import-sync-size-fix-3` targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Baseline `dev` is 682,107 B gzip against a 682,300 B app-assets budget. The first implementation reached 682,538 B; prior compaction reached 682,491 B; the generic WebP parser experiment reached 682,507 B and is being removed. This pass preserves the high-value performance work (four-worker photo restore, batched RxDB restore planning, zero-deflate TodoMate WebP ZIP entries, and TodoMate task create-first sync) while shrinking support code: account-switch preview invalidation uses a compact owner ref/effect, the low-priority pre-local-apply recovery callback is removed, the photo worker loop is shortened without changing rolling four-way concurrency, and only TodoMate's reserved backup source prefix enables the already-compressed upload path.
Next action: Run focused verification. If green, squash-merge into `perf/todomate-import-sync-audit`, then require the full canonical Quality Gate and a READY Vercel Preview with `appAssetsGzipBytes <= 682,300 B`. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- TodoMate adapter mapping/photo tests.
- TodoMate import sheet stale-preview and account-switch invalidation regressions.
- Restore large-row/idempotence coverage plus TodoMate-source precompressed handoff.
- Storage restore-image idempotence/account guard, generic compression, and explicit precompressed upload.
- Task replication create-first success and 409 fallback, alongside existing conflict/reaction/pending-image tests.
- Focused CI on this task branch; stable Preview then receives full canonical verification and the production bundle-size/deployment check.

## Working files

- `src/components/modals/TodoMateImportSheet.tsx`
- `src/lib/todomateImport.ts`
- `src/lib/restoreData.ts`
- `src/lib/storage.ts`
- `src/db/taskReplicationPilot.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `tests/unit/todomateImport.test.ts`
- `tests/unit/restoreData.test.ts`
- `tests/unit/restoreData.image-preservation.test.ts`
- `tests/unit/storage.test.ts`
- `tests/unit/taskReplicationPilot.test.ts`
- `docs/TODOMATE_IMPORT.md`
