# Session checkpoint

Updated: 2026-09-28

Current task: finish disaster-recovery rollout on `security/disaster-backups`.

Status: the first real production DR backup completed successfully and reconciled exactly
against the live source inventory. Snapshot `20260927T171742476Z` has now been restored
into the isolated spare Appwrite project and the restore CLI's full verification passed.
Both repository-owned Functions are now deployed to the restored project with schedules
disabled and ready deployments. Production scheduling and external stale-backup monitoring
remain disabled until manual application acceptance completes.

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
  1 Storage bucket with 6 files, and 2 ready Functions.
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
- The recovery Function deploy path is covered by unit tests for schedule disabling and
  local CLI configuration. Full canonical acceptance passed at `4fe9bf1f3eeeaf48585ee665940042fd7c75e6d9`.
- The live Function deployment then passed: `message-action` and `dr-backup` each have one
  ready active deployment and blank schedules. `dr-backup` has no R2/encryption secrets
  copied into the restored project.
- The two short-lived Appwrite API keys used for restore and Function deployment were deleted
  after successful use.
- A temporary `localhost` Web platform (`mosaic_dr_localhost`) is registered only for
  manual DR application acceptance.

## Remaining rollout
1. Point a temporary Mosaic build at the DR project and complete manual login/tasks/
   diary/settings/friendships/messages/photos acceptance.
2. Remove the temporary localhost platform after manual acceptance.
3. Only after the drill passes: enable the production daily backup schedule and configure/
   enable the external read-only GitHub stale-backup watcher.

## Constraints
- Never expose R2 credentials, encryption material, password hashes, user content, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Never restore into the production Mosaic project.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: run Mosaic locally with explicit `VITE_APPWRITE_*` environment overrides
pointing to the restored project, use a fresh/private browser context, and complete the
manual acceptance checklist without sharing account passwords or user content in chat.
