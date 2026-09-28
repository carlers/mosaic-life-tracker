# Session checkpoint

Updated: 2026-09-28

Current task: finish disaster-recovery rollout on `security/disaster-backups`.

Status: the first real production DR backup completed successfully and reconciled exactly
against the live source inventory. Snapshot `20260927T171742476Z` has now been restored
into the isolated spare Appwrite project and the restore CLI's full verification passed.
Production scheduling and external stale-backup monitoring remain disabled until Function
deployment and manual application acceptance complete.

## Successful production restore point
- Backup ID: `20260927T171742476Z`.
- Execution `6ab94fb2f3f82c7ebf3d` completed HTTP 200.
- Function-reported counts: 2 users, 559 rows, 6 files.
- Immediately refreshed source baseline matched exactly: 2 users, 559 rows,
  6 files, 615334 file bytes.
- The successful code path encrypts each object, verifies ciphertext metadata by HEAD,
  writes the encrypted manifest, writes the plaintext `COMPLETED` marker, and HEAD-verifies
  that marker before returning success.
- No production backup schedule is enabled yet.

## Current live DR safety state
- `dr_backup` execute roles: none.
- Appwrite scopes remain read-only: users/databases/tables/columns/indexes/rows/buckets/files.
- Schedule remains blank.
- `DR_ALLOW_MANUAL_EXECUTION=false`.
- Active locked deployment `6ab94fbd2b4018d902ce` is ready and uses accepted stable
  source `182a7fa904380bbb574253502c43062a5bfcb636`.
- R2/encryption secrets remain configured and secret.
- Stable Quality Gate run 1214 passed the BigInt-safe DR snapshot/restore repair.

## Spare DR target
- The user explicitly authorized Appwrite project `My first project`
  (`6a96e82d000d1310b3be`, region `fra`) for the isolated DR restore drill.
- Snapshot `20260927T171742476Z` is restored there. Independent live inventory after the
  passing restore shows 2 users, 1 TablesDB database with 10 tables and 559 total rows,
  1 Storage bucket with 6 files, and 0 Functions.
- The project remains reserved for this restore drill; never use production Mosaic as a
  restore target.

## Restore drill progress
- The drill exposed two live Appwrite compatibility differences: empty user prefs cannot be
  sent through `users.updatePrefs`, and empty index `orders`/`lengths` arrays must be
  omitted when recreating indexes.
- Restore now skips empty prefs while preserving non-empty prefs, and strips only empty
  optional index arrays while failing closed on partially populated arrays.
- The full restore completed and printed
  `DR verification passed: users=2 rows=559 files=6`.
- Independent post-restore inventory matched the same totals: 2 users, 559 rows, and
  6 files. The restored database contains 10 tables, matching the dynamic snapshot rather
  than only today's seven bootstrap tables.
- The next recovery step is now repository-owned as
  `npm run dr:deploy-functions -- --target-project <projectId>`. It recreates both
  checked-in Functions in an already restored project, refuses a target that already has
  Functions, and verifies both schedules remain blank after deployment.
- The recovery Function deploy path is covered by unit tests for schedule disabling,
  secret-variable wiring, and local CLI configuration; full canonical acceptance is the
  final automated gate before running it against the restored project.

## Remaining rollout
1. Deploy the two repository-owned Functions to the restored DR target with schedules
   disabled.
2. Point a temporary Mosaic build at the DR project and complete manual login/tasks/
   diary/settings/friendships/messages/photos acceptance.
3. Only after the drill passes: enable the production daily backup schedule and configure/
   enable the external read-only GitHub stale-backup watcher.

## Constraints
- Never expose R2 credentials, encryption material, password hashes, user content, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Never restore into the production Mosaic project.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: create a short-lived Appwrite API key in `My first project` with only
`functions.read` and `functions.write`, export it as `APPWRITE_TARGET_API_KEY` in the
same local shell that already has the escrowed DR variables, pull the latest task branch,
then run `npm run dr:deploy-functions -- --target-project 6a96e82d000d1310b3be`.
Verify both deployments become ready and both schedules remain blank.
