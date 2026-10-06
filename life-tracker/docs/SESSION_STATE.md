# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening, with bundle-size follow-up on `chatgpt/todomate-import-sync-size-fix` targeting stable Preview `perf/todomate-import-sync-audit`.
Status: The initial implementation passed its focused Quality Gate and was squash-merged by PR #294 as `746f86a`. Vercel compiled the app successfully but the build-size policy then rejected `appAssetsGzipBytes` by 238 B (682,538 B vs 682,300 B). The follow-up keeps the same behavior while compacting shipped metadata: TodoMate trusted-photo state is one transfer-level boolean instead of a per-ID array plus Set, the prepared-preview owner marker is a ref instead of React state, and the tiny TodoMate create-first predicate is inlined. The original account-isolation, recovery-marker, bounded-photo restore, RxDB findByIds planning, trusted-WebP upload, and create-first conflict semantics remain unchanged.
Next action: Run the follow-up task branch focused gate. If green, squash-merge into `perf/todomate-import-sync-audit`, then require the stable Preview full canonical gate and a READY Vercel deployment with the build-size guard passing. Do not promote to `dev` or `main` without explicit user instruction.
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
