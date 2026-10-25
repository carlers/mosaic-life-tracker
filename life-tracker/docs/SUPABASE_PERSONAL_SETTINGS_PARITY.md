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

## Strict eighth-table encrypted restore capability — not a hosted write

The historical six-table and accepted newer seven-table private encrypted
restore modes retain their original source pins, unchanged. The real
2026-10-25 R2 backup never contained a Settings table and cannot be claimed
as eight-table recovery.

For a **future independently recorded SHA-256 of a new encrypted archive
actually containing Settings**, the reviewed disposable restore wrapper now
accepts `--fresh-personal-settings-sha256 EXACT_64_HEX` and installs the
reviewed Settings migration **only in its new loopback-only PG17 target**.
It requires all EIGHT archive TABLE DATA objects, refuses nonempty restored
Settings/Diary targets, restores Settings under protected trigger suspension,
then verifies source/target row counts and byte-exact COPY streams including
tombstones and revisions. It excludes stale sessions and writer leases.

Fail-closed safeguard: if the source contains `mosaic_candidate_settings`
TABLE DATA but the caller selects an older six/seven mode, **refuse** the
archive instead of silently dropping Settings. Invalid or ambient mode
overrides are rejected. Nine offline tests cover exact mode/manifest/rows;
the old restored October 25 snapshot remains unchanged.

**Still required before applying hosted Settings SQL:** a nonempty,
age-encrypted eight-table **local synthetic source → independent disposable
PG17 restore** in CI, plus full R2/Storage integration and signed second-owner
parity. The user requested **no Fedora commands until one complete
pre-social operator acceptance bundle is ready**. This source-only capability
is not that final operator command.

## Disposable real eight-table age recovery lab

New `supabase-poc/eight-table-restore-lab.sh` and
`.github/workflows/supabase-eight-table-restore.yml` run without
hosted credentials on an isolated GitHub runner. The test prepares
PostgreSQL 17 + signed GoTrue and inserts **synthetic nonempty Settings
rows**, including a deletion tombstone and revision; it captures all
eight data objects in one age-encrypted full database archive.

It then stops the source, invokes the same strict checked
`run-private-core-recovery.sh --fresh-personal-settings-sha256`
against **a newly created independent** loopback-only PG17 instance,
proves exact eight-table COPY row parity and authenticated original
password sign-in, RLS owner read, foreign-owner denial, revision and
tombstone preservation. Both local stacks, bridge, encrypted temporary
archive and synthetic credentials are cleaned up on exit.

This is a CI-only disposable source/target with no live owner data,
not yet a verified Settings snapshot in the actual R2 bucket. It can
be accepted only when the exact stable-branch real lab run is green.
Hosted Settings installation, signed runtime replication and unified
R2 operational allowlists remain later distinct gates. No Fedora
command should be issued until the full pre-social acceptance bundle.
