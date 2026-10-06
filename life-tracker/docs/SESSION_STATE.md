# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening on stable Preview `perf/todomate-import-sync-audit`.
Status: Implementation is complete and accepted on code head `56d9d38`. Full canonical Quality Gate run `37412169263` completed successfully: lint, unit tests, handler tests, both DOM shards, both browser-contract shards, dependency audit, production build, and canonical acceptance are green. Vercel deployment `dpl_5r1c9pxm8dgouU8hQPj43zsTfPvL` is READY. The fixed production build-size budget passes at `appAssetsGzipBytes = 682,262 B / 682,300 B`, giving 38 B of headroom versus the ~13 B rebuild variation observed on otherwise identical app code. The accepted optimization keeps four-worker TodoMate photo preparation and restore upload, RxDB `findByIds()` restore planning, zero-deflate TodoMate WebP ZIP entries, TodoMate-precompressed upload reuse, create-first fresh TodoMate task replication with 409 fallback, cross-account prepared-preview refusal, and one consolidated detailed restore-progress channel for both TodoMate and generic Backup & Restore.
Next action: No further automated work is required on this task after this checkpoint is merged and its docs-only stable rebuild is green. Optional manual acceptance is a real-account timing comparison of Preview/import/sync against the prior behavior; that requires the user's TodoMate credentials and must be done by the user locally. Do not promote `perf/todomate-import-sync-audit` to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification evidence

- Focused verification passed for each implementation/fix branch before squash promotion.
- Stable full Quality Gate: `37412169263` — canonical acceptance succeeded.
- Stable Vercel code SHA: `56d9d382dc91c1646f662c9ae50d19d695c92f20`.
- Vercel deployment: READY.
- Production size: `682,262 B` app-assets gzip against a `682,300 B` fixed budget.
- Existing live correctness evidence remains: TodoMate preview/import previously succeeded with 505 tasks, 13 categories, 1 diary entry, 3 undated tasks, and all 37 photo attachments copied on re-import without task duplication.

## Accepted implementation

- TodoMate photo preparation remains bounded to four concurrent download/compression workers.
- Restore uploads referenced photos through a rolling four-worker pool instead of serially.
- Restore planning resolves existing documents per collection with RxDB `findByIds()` instead of serial per-row planning lookups.
- TodoMate migration ZIP stores already-compressed WebPs without another deflate pass.
- Restore uses TodoMate's reserved source-user prefix to upload adapter-produced WebPs without a second image-compression pass.
- Fresh, side-effect-free TodoMate task replication attempts create first; a 409 falls back to the established remote-read/bootstrap conflict path.
- Prepared TodoMate previews retain their Mosaic owner and Import refuses cross-account application.
- Restore progress uses one detailed message/percentage channel for TodoMate and generic Backup & Restore.
- Bounded post-restore convergence and sync-pending semantics remain unchanged.
- The lower-priority recovery-marker timing refinement was intentionally dropped; starting Import may leave an `applying` marker if preflight then fails, but deterministic Merge reruns remain duplicate-safe.

## Working files

- `src/components/modals/TodoMateImportSheet.tsx`
- `src/components/modals/ExportDataSheet.tsx`
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
