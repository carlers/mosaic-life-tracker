# Session checkpoint

Updated: 2026-10-08
Task: Scratch production-compatible baseline and repeatable backend-dependent
Preview preparation. Work branch `chatgpt/preview-scratch-parity` based on
`feature/notifications-alerts` at `68b2c802`.
No promotion to dev/main and no production project mutation.

## Scratch changes executed

- Isolated scratch ID `6a96e82d000d1310b3be`, endpoint fra.
- Added optional default-empty 50-character `diary.created_at` column;
  verified status available and an isolated synthetic Diary row was
  successfully written and read with a supplied `created_at` value.
- Added missing server-only `account_deletions` table with manifest-owned
  columns/indexes and both missing message sender/recipient indexes.
  Read-back confirmed all two message indexes available and table exists.
- Added missing non-secret Function variables: `APPWRITE_STORAGE_BUCKET_ID`,
  `APPWRITE_TABLE_ACCOUNT_DELETIONS`, `DR_BACKUP_FUNCTION_ID`, and
  `DR_PRIVACY_DELETION_REQUIRED=false` (scratch deliberately has no DR
  restoration archive/scheduled backup).
- Aligned scratch auth policies: disabled email-OTP, anonymous login, JWT,
  and phone. Invites remain enabled: Appwrite's attempted update was
  blocked by tool safety policy; explicitly re-check before auth parity
  acceptance. Production currently has invites disabled.
- No production user data or account hashes copied. Existing notification
  Function deployment `6ac77056dfae4233346e` remains active on scratch.

## Repository changes

- `scripts/appwrite-preview-prepare.mjs` defaults to a read-only managed
  backend drift check; requires literal scratch project and region. `--apply`
  requires double-confirmation, refuses unknown drift, invokes safe numbered
  idempotent migrations, and rechecks. It excludes the permission-changing
  bucket migration 003. Optional reviewed active deployment ID assertion.
- `scripts/appwrite-preview-seed.mjs`: opt-in, credential-injected two-account
  synthetic fixture dataset (profile/category/task/diary/friendships), no
  copying real account data or resetting existing test credentials.
- Unit regressions for target safety, safe migration selection, active-code
  pinning, idempotence, ownership and secrets. CI and scripts added to
  `package.json`.
- `docs/SCRATCH_PREVIEW_WORKFLOW.md` and updates to backend, delivery,
  agents, and roadmap rules. Scratch and DR share the same project; any
  reset requires an exclusive maintenance window and explicit approval.

## Completion criteria and known manual/connector blockers

- Verify focused CI on task branch and canonical/READY Preview after squash;
  preserve stable branch and dev/main.
- Cloud CLI needs separately supplied scratch API key; connected Appwrite
  Console tools cannot provide a portable API key to npm. The live project
  drift checks and migrations can be verified through Console read-only
  calls; do not claim CLI execution without a key.
- Seeding accounts requires a scratch-only test password and API key;
  synthetic fixture code can be verified in CI, but browser login and real
  TodoMate import/full Diary replication remain manual acceptance.
- Invites auth policy mismatch remains until safe authorized config change
  can be made using supported tools.
- Manual Samsung Web Push behavior, lock-screen detail opt-in and deep-link
  opening remain a separate notifications acceptance gate.
