# Isolated Supabase personal Settings parity — #1027

> **Hosted status — 2026-10-26:** The user approved additive `mosaic-dev` private Settings SQL after fresh verified encrypted seven-table R2 backup and independent real Fedora PostgreSQL/Auth/Storage restore. The exact reviewed source `20261025_candidate_private_personal_settings.sql` has now been applied to Supabase `hcxtiifzxoaflhjgoglb` as migration `20261026133252_candidate_private_personal_settings_20261026`, and `20261025_private_settings_contract.sql` catalog verification PASSED. Live `public.mosaic_candidate_settings` is empty; authenticated owner-only SELECT/INSERT, no anonymous grants or direct UPDATE/DELETE, owner lease/sequence triggers and reviewed CAS function are present. **This is hosted schema installation only:** historical preferences remain in Appwrite/ZIP and have not been copied, signed two-owner hosted HTTP tests and real six-domain Sync Now/device acceptance remain open. Production/dev/main are unchanged. After the additive ten-table schema, a NEW full ten-table private R2 backup and independently restored generation is still required; do not reuse the seven-table format.


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

## Signed post-restore adversarial readback contract

PostgreSQL `RETURNS public.mosaic_candidate_settings` with no updated
foreign-owner row may return a PostgREST object containing one null value
per composite column rather than JSON `null`. The lab must refuse
a **populated** foreign CAS result, then independently reread the
restored owner's row using that owner's new signed session and verify
the exact original value, `is_deleted` tombstone and `change_seq`
remain unchanged. This is stronger than trusting the RPC response alone.
The eight-table live CI lab is **not** accepted until that signed
post-attack re-read succeeds in the complete run.

## Authenticated full TOC/profile verification in disposable eight-table CI

The real age-encrypted Settings recovery lab now additionally invokes the
same `inspect-encrypted-backup-toc.sh` and
`recovery-profile.mjs` used by the unified R2 backup uploader on its
synthetic nonempty PostgreSQL 17 source archive. It demands the explicit
eight-personal-settings restore profile, refuses the historical seven mode
against that exact same archive, and emits
`MOSAIC_SETTINGS_EIGHT_TABLE_TOC_PROFILE_PASS` only if all TOC invariants
match. The lab still performs independent exact-COPY restore and fresh signed
owner/tombstone/foreign-owner verification afterward.

This is **disposable CI evidence**, not a new actual hosted R2 Settings
backup or live Settings writer authorization. User's next Fedora request
remains a single consolidated pre-social acceptance command.

## PostgreSQL 17 authenticated TOC in synthetic eight-table lab

The R2 publication gate validates an entire age archive and inspects its pg_dump
TOC. An Ubuntu 24.04 default PostgreSQL 16 `pg_restore` cannot interpret
archives emitted by disposable PostgreSQL 17 (`unsupported version 1.16`).
For the disposable eight-table CI lab only, the existing TOC inspector now
runs `pg_restore --list` inside the exact PG17 source container through a
strict private executable wrapper; authentication, TOC identity and seven-
versus-eight profile enforcement remain unchanged. Never drop the TOC gate,
accept an error as an empty inventory, or publish from an unverified archive.
Actual signed test and full restore must still pass in canonical CI before
calling this change accepted. No hosted PostgreSQL or R2 mutation occurs.

## Signed Settings incremental READ (source only)

The existing verified Supabase HTTP session, bearer token, and epoch guard
now support a read-only Settings domain. pullCandidateSettings validates every
owner/key/value/tombstone and monotone bigint revision before moving its
checkpoint; it refuses foreign owners, unsupported avatar/social keys,
invalid or reordered values, oversize pages and account changes in flight.
Opaque string preferences remain byte-exact. The write-domain union and
Appwrite Production runtime are unchanged. Hosted Settings SQL remains
unapplied; no Settings writer, RxDB subscription or provider cutover is enabled.

## Source-only signed owner Settings CREATE and CAS transport

The existing candidate verified-session CREATE/master and revision-CAS
transports now support an isolated **Settings** domain, deliberately NOT
wired into the shipped Appwrite or new RxDB runtime. New Settings creates
map exact legacy owner/key/opaque string and tombstone, never client-owned
change_seq nor upsert. 409 conflicts force a fresh owner-filtered GET;
an invisible duplicate key is a failure, not an insert success.
An invalid remote owner/setting/unsupported avatar or friend reference
cannot be treated as an accepted master. Transport rechecks server-verified
session epoch and bearer both before and after the request.

Settings CAS only accepts setting_value (string, <= 65536), updated_at
(valid timestamp string) and is_deleted (boolean) and refuses owner/ID/key
or revision spoofing before network. It invokes the existing owner-only
mosaic_candidate_cas_setting RPC, expects a strictly newer revision and
normalizes NULL/typed-null conflicts without acking an edit. No physical
delete or direct UPDATE permission is introduced. Offline tests cover
positive and negative create/CAS. Existing Core App Lab already proves
actual signed two-owner SQL grant/lease/RLS/CAS; this extension itself is
client transport only. Hosted Settings still unapplied; private full eight-
table DR gates must precede any live Settings user data.


## Source-only Settings RxDB replica adapter (NOT activated)

The generic isolated `candidateRxdbPilot.ts` now supports the explicit
`settings` domain **only when instantiated by a test or future gated owner
bridge**. Existing Appwrite Production and the current Supabase core runtime
still start only their previously authorized task/category/Diary domains.
The adapter delegates to the already-signed Settings owner-scoped incremental
pull, create-master and expected-revision CAS transports. It never invents
a checkpoint or edits an owner key: it validates the server-side revision,
keeps tombstones as ordinary `isDeleted` documents (RxDB `_deleted=false`),
refuses foreign/profile-avatar/social rows, parks divergent conflicts for
explicit owner review, and does not directly acknowledge unresolved local edits.
Unknown but valid preference keys are preserved byte-for-byte.

The *live* owner Settings collection also contains provider-specific avatar
and social values. Do NOT attach this replica directly to the shipped shared
Settings collection or enable it alongside Appwrite without first building
a separately verified, complete feature-migration/owner-writer-fence strategy.
This source-only adapter's CI tests do not constitute an approved hosted
Settings writer, user-data backfill or two-device/offline acceptance.

## Complete-owner Settings history replay and exact target readback (offline, 2026-10-26)

New `candidateSettingsHistoryReplay.ts` prepares a **complete-owner,
source-only** replay partition. It requires externally authenticated original
Settings count (including tombstones), deterministic original six-field row
digest, seven-domain original scan SHA and full encrypted original-source
ciphertext SHA. It rejects foreign/duplicate IDs, duplicated preference keys,
missing entries, incorrect tombstones, changed or oversized original values,
invalid timestamps and any changed original content hash. Unsupported
`profileImageId` and `friend_carousel_prefs` stay deferred,
preserved ONLY in the previously encrypted full owner source, and are
represented by original IDs/keys/tombstone status and field SHA—NOT imported
or silently dropped. All five other example preference keys, including unknown
future keys and deleted values, remain byte-exact Supabase-mapped rows.

The companion readback verifier accepts only an **independently complete
signed and owner-fenced Supabase target snapshot**, requires a separate
pin of the exact plan hash, validates authoritative int8 revisions and
server timestamps, disallows extra/duplicate/wrong-owner/unsupported rows
and compares original ID, key, opaque value, timestamp and tombstone fields.
It returns counts/digests only and never sets real source-authority,
target-authentication, media/social migration or provider-cutover flags true.
Unit tests cover complete and reordered originals, duplicate preference keys,
tampering, unknown future settings, source omissions and foreign/modified
target revisions. This still is **not** a hosted Settings migration or
encrypted live deferred-history retention proof. No active RxDB Settings
replicator, Appwrite backend, Supabase hosted SQL, Production, R2 or Fedora
changes occurred.
