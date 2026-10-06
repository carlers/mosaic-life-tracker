# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening, with bundle-budget follow-up on `chatgpt/todomate-import-sync-size-fix-2` targeting stable Preview `perf/todomate-import-sync-audit`.
Status: The stable Preview compiles, but Vercel still rejects `appAssetsGzipBytes` by 191 B (682,491 B vs 682,300 B). This follow-up removes TodoMate-specific precompressed-image metadata from the shipped path: restore now detects already-small files with a valid WebP RIFF/WEBP header and uploads them directly, while mislabeled or oversized bytes still use normal compression. It also removes the redundant prepared-preview owner ref and reuses the existing Mosaic-account ref for the synchronous account-switch guard. Account isolation, bounded four-worker photo restore, batched RxDB planning, recovery timing, Merge semantics, and TodoMate create-first conflict behavior remain unchanged.
Next action: Run focused verification on this task branch. If green, squash-merge into `perf/todomate-import-sync-audit`, then require the stable full canonical Quality Gate and a READY Vercel Preview with the build-size guard under budget. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- TodoMate adapter mapping/photo tests.
- TodoMate import sheet account-switch and pre-local-apply recovery-marker regressions.
- Restore large-row/idempotence coverage and bundled-image handoff.
- Storage restore-image idempotence/account guard, valid-small-WebP bypass, and mislabeled-WebP compression fallback.
- Task replication create-first success and 409 fallback, alongside existing conflict/reaction/pending-image tests.
- Focused CI on this follow-up; stable Preview then receives the full canonical gate and Vercel deployment/build-size check.

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
