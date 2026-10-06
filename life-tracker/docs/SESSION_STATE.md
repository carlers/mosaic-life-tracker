# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync performance and race hardening, with bundle-budget follow-up on `chatgpt/todomate-import-sync-size-fix-4` targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Stable Preview `9d3cd34` passes compilation but is only 24 B over the production `appAssetsGzipBytes` budget (682,324 B / 682,300 B), down from the original 238 B miss. This final trim is intentionally behavior-neutral: remove redundant preview-owner reset bookkeeping, reuse the captured `currentUser.id` instead of a temporary preview-user variable, omit an abort call that cannot have an in-flight request because the preview guard already forbids concurrent starts, and collapse the stale-owner Import branch. The account-isolation guard, four-worker photo restore, batched RxDB planning, TodoMate WebP no-recompression path, and create-first task sync remain unchanged.
Next action: Run focused verification. If green, squash-merge into `perf/todomate-import-sync-audit`, then require the stable full canonical Quality Gate and a READY Vercel Preview with the build-size guard passing. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- TodoMate import sheet stale-preview handling and cross-account import refusal.
- Existing TodoMate adapter/restore/storage/task-replication focused coverage selected by changed-file verification.
- Stable Preview full canonical verification plus production compile/service-worker/build-size/deployment acceptance.

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
