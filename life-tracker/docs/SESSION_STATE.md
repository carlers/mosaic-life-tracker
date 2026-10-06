# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync runtime repair on `chatgpt/todomate-import-runtime-fixes`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Post-acceptance real use exposed `u.get is not a function` immediately after clicking Import. Root cause is the restore planning optimization: RxDB 17.5 `findByIds()` returns an RxQuery and the production code must call `.exec()` to receive the Map, while the new unit-test doubles incorrectly returned a Map directly. The repair changes the production call to `findByIds(...).exec()` and updates the doubles to the real query shape. The same repair also closes two audit findings: precompressed-photo trust is moved from spoofable backup `user.id` metadata to an in-memory `trustedPrecompressedImages` restore option supplied only by the TodoMate sheet, and Storage 429s during photo restore get up to two one-minute retries before failing the import visibly instead of being counted as missing photos. Four-worker photo concurrency, deterministic IDs, Merge semantics, account guards, create-first task replication, and consolidated restore progress remain unchanged.
Next action: Create one coherent task commit with the implementation, regression tests, and this checkpoint; request focused verification; fix any failures; then squash-merge into `perf/todomate-import-sync-audit` and require the stable full canonical gate plus READY Vercel/build-size acceptance. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- Restore planning test doubles expose `findByIds().exec()`, so calling `.get()` on the query object can no longer pass unit tests.
- Generic backups with a forged `todomate_*` source ID do not receive the precompressed fast path.
- TodoMate UI explicitly passes the trusted in-memory precompressed flag.
- Persistent Storage 429s retry twice and reject the restore instead of incrementing `imagesMissing`.
- Existing large-import/idempotence, account-switch, storage-permission, task-replication, progress, and browser contracts remain green.
- Stable build remains inside the fixed production bundle-size budget.

## Working files

- `src/lib/restoreData.ts`
- `src/components/modals/TodoMateImportSheet.tsx`
- `tests/unit/restoreData.test.ts`
- `tests/unit/restoreData.image-preservation.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `docs/TODOMATE_IMPORT.md`
