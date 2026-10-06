# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening on stable Preview `perf/todomate-import-sync-audit`.
Status: Implementation is complete and accepted on code head `45a2727`. The final stable Preview production build is READY and the build-size guard passes at `appAssetsGzipBytes = 682,295 B / 682,300 B`. Full canonical Quality Gate run `37411089103` completed successfully: lint, unit tests, handler tests, both DOM shards, both browser-contract shards, dependency audit, production build, and canonical acceptance are green. The accepted optimization keeps four-worker photo restore, RxDB `findByIds()` restore planning, zero-deflate TodoMate WebP ZIP entries, TodoMate-precompressed upload reuse, and create-first fresh TodoMate task replication with 409 fallback. Prepared previews are bound to the Mosaic account that created them and cannot restore under a different account. The lower-priority recovery-marker timing refinement was intentionally dropped to keep the production bundle within its fixed budget; starting Import may leave an `applying` marker if preflight then fails, but rerunning remains deterministic and duplicate-safe.
Next action: No further automated work is required on this task. Optional manual acceptance is a real-account timing comparison of Preview/import/sync against the prior behavior; that requires the user's TodoMate credentials and must be done by the user locally. Do not promote `perf/todomate-import-sync-audit` to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification evidence

- Focused task verification passed on the final code-size follow-up.
- Stable full Quality Gate: `37411089103` — canonical acceptance succeeded.
- Stable Vercel Preview code SHA: `45a272716616b75ec783d282e6f2b77c7d7f9f06`.
- Vercel deployment: READY.
- Production size: `682,295 B` app-assets gzip against a `682,300 B` budget.
- Existing live correctness evidence remains: TodoMate preview/import previously succeeded with 505 tasks, 13 categories, 1 diary entry, 3 undated tasks, and all 37 photo attachments copied on re-import without task duplication.

## Accepted implementation

- TodoMate photo preparation remains bounded to four concurrent download/compression workers.
- Restore uploads referenced photos through a rolling four-worker pool rather than serially.
- Restore planning resolves existing documents per collection with RxDB `findByIds()` instead of serial per-row planning lookups.
- TodoMate migration ZIP stores already-compressed WebPs with no additional deflate pass.
- Restore recognizes the reserved TodoMate source-user prefix and uploads those adapter-produced WebPs without a second image-compression pass.
- Fresh, side-effect-free TodoMate task replication attempts create first; a 409 falls back to the established remote-read/bootstrap conflict path.
- Prepared TodoMate previews retain their Mosaic owner and Import refuses cross-account application.
- Restore/import progress and the bounded post-restore convergence behavior remain unchanged.

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
