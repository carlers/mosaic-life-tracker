# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening, with compile follow-up on `chatgpt/todomate-import-sync-type-fix` targeting stable Preview `perf/todomate-import-sync-audit`.
Status: The size-compaction follow-up was squash-merged as `0e03870`. Vercel immediately caught a TypeScript annotation omission in `makeMosaicBackup`: its local `photoResult` parameter type had not been extended with the new aggregate `precompressed` boolean even though the producer and runtime object include it. This follow-up adds that missing type member only; runtime semantics are unchanged.
Next action: Require focused verification and a successful task-branch Vercel build, then squash-merge into `perf/todomate-import-sync-audit` and rerun the stable full canonical gate plus READY Vercel/build-size check. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- TodoMate adapter mapping/photo tests, including transfer-level trusted-WebP metadata.
- TodoMate import sheet account-switch and pre-local-apply recovery-marker regressions.
- Restore large-row/idempotence coverage plus trusted-WebP restore behavior.
- Storage restore-image idempotence/account guard plus precompressed upload behavior.
- Task replication create-first success and 409 fallback, alongside existing conflict/reaction/pending-image tests.
- Focused CI on this compacting follow-up; stable Preview then receives the full canonical gate and Vercel deployment/build-size check.

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
