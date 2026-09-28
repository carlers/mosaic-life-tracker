# Session checkpoint

Updated: 2026-09-28

Current task: finish disaster-recovery rollout on `security/disaster-backups`.

Status: the first real production DR backup completed successfully and reconciled exactly
against the live source inventory. The isolated restore drill is actively exercising that
snapshot against the spare Appwrite project; production scheduling and external stale-backup
monitoring remain disabled until the drill passes.

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
- Rechecked after authorization: it is still empty with 0 TablesDB databases, 0 users,
  0 Storage buckets, and 0 Functions.
- It is now reserved for restoring snapshot `20260927T171742476Z`; never use production
  Mosaic as a restore target.

## Restore drill progress
- The restore reached Auth import and exposed two live Appwrite compatibility differences:
  empty user prefs cannot be sent through `users.updatePrefs`, and empty index `orders`/
  `lengths` arrays must be omitted when recreating indexes.
- Restore now skips empty prefs while preserving non-empty prefs, and strips only empty
  optional index arrays while failing closed on partially populated arrays.
- Regression coverage exists for both behaviors; Quality Gate run 1224 passed at commit
  `2ec6d249e9fd041c4d988789f2079ee13d9c86e8`.
- After the latest failed attempt, the two partial users and `life_tracker` database were
  deleted and the spare target was rechecked empty (0 users, 0 TablesDB databases, 0 buckets).

## Remaining rollout
1. Restore snapshot `20260927T171742476Z` into the isolated DR project.
2. Verify users/hash metadata, schemas/indexes/permissions, all 559 rows/IDs/data,
   6 file IDs/hashes/permissions, and snapshot checksums.
3. Deploy the two repository-owned Functions to the DR target with schedules disabled.
4. Point a temporary Mosaic build at the DR project and complete manual login/tasks/
   diary/settings/friendships/messages/photos acceptance.
5. Only after the drill passes: enable the production daily backup schedule and configure/
   enable the external read-only GitHub stale-backup watcher.

## Constraints
- Never expose R2 credentials, encryption material, password hashes, user content, or raw
  provider error bodies.
- Keep `DR_ALLOW_MANUAL_EXECUTION=false` outside a controlled execution window.
- Never restore into the production Mosaic project.
- Do not promote `security/disaster-backups` to `dev` without explicit user instruction.

Next action: pull the latest `chatgpt/dr-restore-drill-authorized` branch and rerun
`dr:restore` locally against `My first project` with the already prepared short-lived
target API key, escrowed read-only R2 recovery credential, and DR encryption key. Continue
fixing restore-only compatibility issues until the full verification passes.
