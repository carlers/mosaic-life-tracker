# Session checkpoint

Updated: 2026-10-08 — follow-up fix: phone Preview manual Sync Now falsely reports another tab.
Branch: `chatgpt/fix-mobile-sync-leadership-timeout` from `feature/notifications-alerts` at `4edcdb67`.
Root cause: `replicationFreshness.ts` raced RxDB's local leader election against a hardcoded 1,000 ms timer and unconditionally blamed another tab on expiry. Browser leader election shares a local origin/device, not a remote laptop. The same sync source is byte-identical on main and Preview; Preview uses its own phone browser origin/state. Category is the first of six concurrently checked pilots, so its name does not indicate an Appwrite category schema defect.
Change: allow a bounded 10-second grace within the existing 90-second freshness deadline, preserve fail-closed leader ownership, and report a local election timeout instead of asserting another tab exists. Add slow mobile-election/timeout tests and update category/diary regression assertions and sync documentation. No Appwrite mutations, no dev/main merge.
Remaining: focused test/CI, squash onto stable feature Preview, canonical CI/Vercel READY, manual phone acceptance. If phone remains a genuine non-leader due another same-origin PWA instance, Sync Now will still fail closed; cross-tab leader delegation is a separate product change.

---


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
- Aligned scratch auth policies: disabled email-OTP, anonymous login,
  invites, JWT and phone. A second confirmed-target operation disabled
  invites after the first attempt was blocked; read-back from both
  Appwrite projects confirms matching email-password/magic-url enabled,
  all five remaining methods disabled.
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
- Auth method parity has been verified in Appwrite; functional login and
  browser CORS checks still require actual disposable-account testing.
- Manual Samsung Web Push behavior, lock-screen detail opt-in and deep-link
  opening remain a separate notifications acceptance gate.
