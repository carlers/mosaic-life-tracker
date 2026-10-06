# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import runtime repair and final bundle jitter headroom on `chatgpt/todomate-import-runtime-size-headroom-2`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Real use exposed `u.get is not a function` after clicking Import. Stable now contains the runtime repair: restore planning executes RxDB 17.5 `findByIds(...).exec()`, unit doubles preserve the query shape, TodoMate's precompressed-image fast path is trusted only from an in-memory caller value, and Storage 429s get one bounded 60-second retry before persistent throttling rejects instead of becoming a missing photo. Stable code head `633e289` passed all substantive canonical jobs and Vercel is READY; its app-assets gzip result is 682,289 / 682,300 B. Because 11 B is smaller than the ~13 B rebuild variation observed earlier, this follow-up removes a redundant intermediate ArrayBuffer copy when creating restored photo Files. The File receives the same Uint8Array bytes directly; the TypeScript-only BlobPart cast emits no runtime code. No import, validation, account, retry, progress, image, or sync semantics change.
Next action: Commit this behavior-neutral size trim with focused verification. If green, squash-merge into `perf/todomate-import-sync-audit`, then require full canonical CI plus a READY Vercel Preview with useful build-size headroom. After stable acceptance, the user should rerun the real TodoMate import to verify the `u.get` crash is gone and compare Preview/import/sync wall time. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- Restore planning continues to await `findByIds(...).exec()` before Map access.
- Generic backups cannot spoof TodoMate's precompressed image trust.
- Storage 429 handling remains one 60-second retry followed by visible failure if throttling persists.
- Restored image File bytes are unchanged when constructed directly from the Uint8Array.
- Existing large-import/idempotence, account-switch, image-permission, progress, task-replication, and browser contracts remain green.
- Stable Vercel build is below the fixed 682,300 B app-assets gzip budget with margin greater than observed rebuild jitter.

## Working files

- `src/lib/restoreData.ts`
- `src/db/sync.ts`
- `src/components/modals/TodoMateImportSheet.tsx`
- `tests/unit/restoreData.test.ts`
- `tests/unit/restoreData.image-preservation.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `docs/TODOMATE_IMPORT.md`
