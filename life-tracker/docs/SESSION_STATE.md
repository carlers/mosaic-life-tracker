# Session checkpoint

Updated: 2026-10-06
Current task: TodoMate import/sync runtime repair with bundle-size follow-up on `chatgpt/todomate-import-runtime-size-fix`, targeting stable Preview `perf/todomate-import-sync-audit`.
Status: Real use exposed `u.get is not a function` after clicking Import. The repair is confirmed: RxDB 17.5 `findByIds()` returns an RxQuery, so restore planning now calls `findByIds(...).exec()`; unit doubles now preserve that real query shape. The first repair also moved precompressed-photo trust out of spoofable backup metadata into an in-memory restore option and made Storage 429s retry instead of becoming missing photos, but its stable Vercel build exceeded the fixed app-assets gzip budget by 148 B. This follow-up keeps all correctness boundaries while shrinking runtime code: the in-memory flag is named `precompressedImages`, rate-limit detection checks Appwrite's numeric code/cause only, and a 429 waits one minute then retries once; a second 429 rejects the import visibly. Four-worker photo concurrency, deterministic IDs, Merge semantics, account guards, create-first task replication, and consolidated restore progress remain unchanged.
Next action: Commit this compact follow-up with focused verification. If green, squash-merge into `perf/todomate-import-sync-audit` and require full canonical CI plus READY Vercel/build-size acceptance. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None.

## Verification target

- Production restore uses `findByIds(...).exec()` and test doubles expose the same query contract.
- Generic backups with forged `todomate_*` metadata do not receive the precompressed fast path.
- TodoMate UI passes `precompressedImages: true` in memory.
- A Storage 429 waits once and retries; a second 429 rejects instead of incrementing `imagesMissing`.
- Existing large-import/idempotence, account-switch, storage-permission, task-replication, progress, and browser contracts remain green.
- Stable build remains inside the fixed production bundle-size budget.

## Working files

- `src/lib/restoreData.ts`
- `src/components/modals/TodoMateImportSheet.tsx`
- `tests/unit/restoreData.test.ts`
- `tests/components/TodoMateImportSheet.test.tsx`
- `docs/TODOMATE_IMPORT.md`
- `docs/SESSION_STATE.md`
