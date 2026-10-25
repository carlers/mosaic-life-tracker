# Isolated Supabase personal Settings parity — #1027

**Status (2026-10-25): Source only; SQL has NOT been installed; no cloud
writer or provider switch is enabled.** This is not Production readiness.

The existing Appwrite/RxDB SettingsDocument model carries an opaque string
value, a legacy stable ID, key, owner, updatedAt and isDeleted tombstone.
The new candidateSettingsMapping.ts preserves these values, validates the
explicit original Appwrite owner to verified Supabase Auth UUID mapping, and
never fabricates server revision/change timestamps. JSON and plain strings
remain opaque and unmodified. It refuses invalid IDs, foreign owners,
malformed values, and provider-specific profileImageId and
friend_carousel_prefs. Unsupported provider references must be kept in the
source export / encrypted migration ledger, never silently deleted.

The reviewed but UNAPPLIED SQL source migration is at
supabase-poc/migrations/20261025_candidate_private_personal_settings.sql.
It creates an owner-private, unique-owner+key table, authenticated
owner-only RLS SELECT/INSERT, no direct UPDATE or DELETE, immutable owner/ID
revision stamping and an expected-change_seq atomic CAS for value/timestamp
and tombstone. It reuses the already accepted local Core authority guard.
No public/anonymous writes or social reads are part of this contract.

## Required gates before hosted installation

- Verify the actual SQL in disposable PostgreSQL 17 with signed GoTrue
  tokens for two separate owners, plus anonymous and foreign-account negative
  reads/inserts/CAS; test stale CAS, repeated writes, tombstone replay and
  duplicate owner-key refusal. Source-only TypeScript tests do not count as
  database authorization proof.
- Update encrypted PostgreSQL backup, private restore allowlists and
  independent row parity for eight data tables rather than the currently
  restored seven before storing live Settings records. Preserve old accepted
  offsite snapshots unchanged. Do not broaden DR using unreviewed
  pg_restore fallback.
- Add signed owner-scoped incremental pull/CAS/create, local RxDB
  checkpoints, account switch/offline replay, and a verified exclusive
  Appwrite-writer fence/lease before enabling a Settings writer.
- Accept source ZIP/backfill, cross-device Settings parity and retained
  unsupported avatar/friend settings. Never quietly reset user preferences.

No hosted SQL, R2 data, Production, Appwrite, dev/main, alerts, scheduling or
pruning change is authorized by this source-only acceptance.

## Disposable signed database CI harness (additional source-only gate)

The Supabase Core App Lab now copies the UNAPPLIED Settings SQL into its
*disposable* local Supabase CLI migration directory, checks table RLS,
restricted privileges, authority/revision triggers and owner-key uniqueness
against actual PostgreSQL, then uses freshly registered local GoTrue users
and signed sessions over loopback PostgREST to exercise: no-lease write denial,
owned create/read, cross-owner read/insert/CAS denial, anonymous denial,
direct UPDATE/DELETE denial, duplicate key conflict, exact change-seq CAS,
stale/replayed conflicts, forbidden patch fields, tombstone and revision
cursor replay, and lease release denial.

Passing CI proves only isolated local signed behavior. Do not apply Settings
SQL to hosted Scratch until the encrypted PG backup/restore allowlists are
updated and verified; no live dataset is recoverable through the old seven-
table DR allowlist for this new domain. No production/user data is modified.
