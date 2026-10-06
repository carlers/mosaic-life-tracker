# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening on task branch `chatgpt/todomate-import-sync-perf`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Implementation is complete on the task branch. The first focused gate ran the changed contract successfully except for one stale restore test double that did not expose RxDB `findByIds`; this commit updates that fixture and requests focused verification again. The patch binds completed TodoMate previews to the Mosaic account that created them; moves recovery-marker creation until local restore application actually starts; stores already-compressed TodoMate WebPs without ZIP deflate and skips the second image-compression pass only for trusted adapter-produced WebPs; restores photos through a bounded four-worker pool; batches restore planning lookups with RxDB `findByIds`; and lets fresh side-effect-free TodoMate task pushes attempt Appwrite create before the predictable missing-row read. A create 409 returns to the existing bootstrap/conflict path, and generic backup validation, pending-image handling, reaction preservation, account-generation guards, and Merge semantics remain unchanged. Appwrite transaction batching is intentionally not used because the repository's prior live CAS proof rejected it for Mosaic replication correctness.
Next action: Require the task branch focused gate to pass, then squash-merge the exact accepted tree into `perf/todomate-import-sync-audit` and require its full canonical gate plus READY Vercel Preview. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- TodoMate adapter mapping/photo tests, including trusted-precompressed metadata.
- TodoMate import sheet account-switch and pre-local-apply recovery-marker regressions.
- Restore large-row/idempotence coverage plus trusted-WebP restore behavior.
- Storage restore-image idempotence/account guard plus precompressed upload behavior.
- Task replication create-first success and 409 fallback, alongside existing conflict/reaction/pending-image tests.
- Focused CI on the coherent task commit; stable Preview receives the routine full canonical gate and Vercel deployment after merge.

## Working files

- `src/components/modals/TodoMateImportSheet.tsx`
- `src/lib/todomateImport.ts`
- `src/lib/restoreData.ts`
- `src/lib/storage.ts`
- `src/db/taskReplicationPilot.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `tests/unit/todomateImport.test.ts`
- `tests/unit/restoreData.test.ts`
- `tests/unit/storage.test.ts`
- `tests/unit/taskReplicationPilot.test.ts`
- `docs/TODOMATE_IMPORT.md`
