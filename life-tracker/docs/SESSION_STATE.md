# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance hardening and runtime repair on stable Preview `perf/todomate-import-sync-audit`.
Status: Implementation is complete and automated acceptance is green on stable code head `15efe3f`. The real-use `u.get is not a function` crash is fixed: RxDB 17.5 restore planning now executes `findByIds(...).exec()` before reading the returned Map, and unit doubles preserve that real query shape so this regression cannot pass tests again. The same repair keeps TodoMate's precompressed-image fast path behind an in-memory caller value rather than spoofable backup metadata, retries one Storage 429 after a 60-second wait before persistent throttling rejects visibly, and preserves four-worker photo restore, create-first TodoMate task replication, Merge/idempotence semantics, account guards, and consolidated restore progress. Full canonical Quality Gate run `37423932711` succeeded, Vercel deployment `dpl_HvY5WeuHpU7MEHAgECY6ATsjs2Hu` is READY, and the fixed production build-size budget passes at `appAssetsGzipBytes = 682,275 B / 682,300 B`.
Next action: The remaining acceptance step is manual real-account verification: rerun TodoMate Preview Transfer and Import into Mosaic, confirm the previous `u.get is not a function` failure is gone, then note rough wall times for preview/photo preparation, local import, and final sync settlement. If that real import is healthy, this branch is ready to merge to `dev` when explicitly requested. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification evidence

- Focused verification passed on every repair/compaction task branch before squash promotion.
- Full canonical Quality Gate: `37423932711` — build, dependency audit, lint/unit/handler checks, both DOM shards, both browser-contract shards, and canonical acceptance all succeeded.
- Stable Vercel SHA: `15efe3f0bd77d9a096d63f815d6762c990414e5a`.
- Stable deployment: `dpl_HvY5WeuHpU7MEHAgECY6ATsjs2Hu` — READY.
- Production size: `682,275 B` app-assets gzip against the fixed `682,300 B` budget.
- Existing live migration evidence remains: 505 tasks, 13 categories, 1 diary entry, 3 undated tasks, and 37 TodoMate photos were previously discovered/copied successfully; the new runtime repair specifically addresses the Import-click crash seen afterward.

## Accepted repair details

- Restore planning uses `findByIds(...).exec()` before Map access.
- Restore unit doubles expose the same RxDB query shape.
- TodoMate precompressed-image trust is supplied only by the live importer call, never inferred from backup manifest contents.
- Photo restore remains bounded to four workers.
- A Storage 429 waits 60 seconds and retries once; a second rate limit rejects the import instead of incrementing `imagesMissing`.
- The private `restoreImages()` helper requires its account/progress/trust arguments from its sole caller, preserving behavior while avoiding dead optional branches.
- Restored image Files use the existing image bytes directly without an intermediate ArrayBuffer clone.
- Create-first fresh TodoMate task replication still falls back to the established remote-read/bootstrap path on conflict.
- Prepared TodoMate previews cannot be applied under a different Mosaic account.
- Generic Backup & Restore and TodoMate both continue to use the consolidated detailed restore-progress channel.

## Working files

- `src/lib/restoreData.ts`
- `src/db/sync.ts`
- `src/components/modals/TodoMateImportSheet.tsx`
- `src/lib/storage.ts`
- `src/db/taskReplicationPilot.ts`
- `tests/unit/restoreData.test.ts`
- `tests/unit/restoreData.image-preservation.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `tests/unit/storage.test.ts`
- `tests/unit/taskReplicationPilot.test.ts`
- `docs/TODOMATE_IMPORT.md`
