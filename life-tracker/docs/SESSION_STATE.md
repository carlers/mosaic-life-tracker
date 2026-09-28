# Session checkpoint

Updated: 2026-09-28

Current task: finish live TodoMate task-photo acceptance after the user's second preview
confirmed all 37 photo attachments are downloadable, but the import restore preflight exposed
a stuck/long-running Mosaic sync.

Working branch: `chatgpt/sync-import-preflight`, based on stable Preview branch
`feature/todomate-importer` at
`e1cdb38c2689a9af92e4ef25690879016a98b8ff`.

## Live evidence
- Original accepted TodoMate migration: 505 tasks, 13 categories, 1 diary entry, 3 undated
  tasks moved to the import day.
- Photo-capable hosted Preview is READY and the user reran **Preview Transfer**.
- The live photo preview reported **37 of 37 TodoMate photo attachments ready to copy**.
- Clicking **Import into Mosaic** did not begin restore writes. Restore stopped at the
  online-freshness safety preflight with:
  `Mosaic could not fully refresh synced data. Try restoring again after sync succeeds.`
- The user also observed the Mosaic sync indicator remaining on Syncing.
- No TodoMate credentials, photo URLs, Firebase tokens, or photo bytes were supplied in chat.

## Root cause found
Two existing sync/restore behaviors combine badly after a large external import:

1. The sync engine pushes dirty rows strictly one at a time. A newly imported task normally
   takes `updateRow` plus the expected 404 `createRow` fallback when it does not exist
   remotely. Hundreds of imported tasks can therefore become roughly twice as many strictly
   sequential Appwrite requests, holding the sync/Web-Lock cycle for a long time.
2. `initializeSync()` intentionally coalesces same-tab re-entry. When called while a sync is
   queued/running, it records a follow-up request and returns immediately. Restore used that
   function as though awaiting it guaranteed a fresh completed cycle, then immediately
   rejected the still-`isSyncing` status.

The restore safety requirement itself is correct and must not be bypassed.

## Implementation
- `src/db/sync.ts`
  - dirty rows within one collection now push with bounded concurrency: at most four workers;
  - collections remain sequential;
  - each row preserves the existing `updateRow` → 404 `createRow` behavior, permissions,
    failure accounting, dirty-boundary rules, and pending-image reconciliation;
  - new `refreshSync()` waits for this tab's queued/running sync coordinator to fully drain,
    then starts and awaits one genuinely fresh cycle;
  - same-tab coordinator waiting is capped at 90 seconds and fails closed with a useful error;
  - cross-tab `mosaic-sync` Web Locks remain authoritative.
- `src/lib/restoreData.ts`
  - online restore/import preflight now uses `refreshSync()` and retains the existing
    last-sync freshness/error checks.
- Regression coverage added in `tests/unit/sync.test.ts` and
  `tests/unit/restoreData.test.ts` for the fresh barrier, bounded push concurrency, and
  restore preflight result contract.
- Durable sync/restore contracts updated in `PROJECT_REFERENCE.md`,
  `BACKUP_RESTORE.md`, and `TODOMATE_IMPORT.md`.

## Verification status
- Diff review is complete and scope is limited to the sync coordinator/push path, restore
  preflight, focused unit regressions, and the corresponding contracts/checkpoint.
- Full Quality Gate 1300 reached checks/DOM successfully but the build caught a TypeScript
  inference error in the new bounded-push failure reduction. The reduction now has an
  explicit numeric accumulator at `6316abd0c134161747af4c1b3bf0fb6f6d5ff0ac`.
- This checkpoint requests a new exact-SHA full canonical gate after that repair.
- No hosted manual acceptance has been claimed for the sync fix yet.

## Remaining
1. Finish focused/diff review and fix any CI failure.
2. Commit this checkpoint with `[verify:full]` on the exact task tip.
3. Wait for canonical acceptance.
4. Squash-deliver the task PR into `feature/todomate-importer`.
5. Verify the stable Vercel Preview is READY.
6. User refreshes the stable Preview, reruns **Preview Transfer** (expected 37/37 ready), then
   **Import into Mosaic**.
7. Confirm the import completes, no duplicate tasks appear, sync settles, and spot-check
   several TodoMate photos now render from Mosaic/Appwrite Storage.
8. Mark the TodoMate photo migration enhancement complete only after that hosted acceptance.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` remains scheduled at `0 11 * * *`.
- External GitHub stale-backup monitoring still requires default-branch
  delivery/configuration; do not promote to `main` without explicit user authorization.

Next action: finish automated acceptance for the sync fix, deliver the stable Preview, and
rerun the hosted 37-photo import acceptance.
