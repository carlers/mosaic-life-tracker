# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import runtime repair and final bundle jitter headroom on `chatgpt/todomate-import-runtime-size-headroom-3`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: The real-use `u.get is not a function` crash is repaired on stable: RxDB 17.5 restore planning executes `findByIds(...).exec()`, unit doubles preserve the query contract, TodoMate's precompressed-image trust comes only from an in-memory caller value, and Storage 429s get one bounded 60-second retry before persistent throttling rejects rather than becoming a missing photo. Stable head `f47ee5b` is fully canonical-green and Vercel READY, but its app-assets gzip result is 682,286 / 682,300 B, only 14 B under the fixed budget. This follow-up tightens the private `restoreImages()` contract: its sole caller always supplies the account guard, image-progress callback, and compression-trust boolean, so the helper no longer ships impossible optional/default branches. No public API or runtime behavior changes.
Next action: Commit this internal-only trim with focused verification. If green, squash-merge into `perf/todomate-import-sync-audit` and require one final full canonical CI + READY Vercel/build-size pass. After stable acceptance, the user should rerun the real TodoMate import to verify the crash is gone and compare Preview/import/sync wall time. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- Restore planning still awaits `findByIds(...).exec()` before Map access.
- Generic backups still cannot spoof TodoMate's precompressed fast path.
- Storage 429 handling remains one 60-second retry followed by visible failure on persistent throttling.
- `restoreImages()` receives required account/progress/trust arguments from its only caller and produces identical progress/account checks.
- Existing large-import/idempotence, account-switch, image-permission, task-replication, progress, and browser contracts remain green.
- Stable Vercel build has materially more than the observed rebuild-jitter margin below 682,300 B.

## Working files

- `src/lib/restoreData.ts`
- `src/db/sync.ts`
- `src/components/modals/TodoMateImportSheet.tsx`
- `tests/unit/restoreData.test.ts`
- `tests/unit/restoreData.image-preservation.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `docs/TODOMATE_IMPORT.md`
