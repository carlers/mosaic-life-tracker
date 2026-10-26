# Source-only owner-private Bucket List and task-link migration (#1027)

**Status (2026-10-25): no hosted SQL/table, sync transport, RxDB writer or live
migration exists.** This mapping and referential-integrity contract is a
pre-social data-preservation gate, not a feature release.

- The source Appwrite/RxDB `BucketListDocument` has an immutable legacy ID,
  title, description, achieved/achievedAt, created/updated dates and soft
  tombstone. The source `BucketTaskLinkDocument` stores a separate stable ID
  and exact `bucketListId`/`taskId` references, dates and soft tombstone.
- `candidateBucketMapping.ts` maps these without rewriting values,
  attaching server-controlled revisions or assuming that the Appwrite account
  identifier equals a Supabase Auth UUID. Both source and remote owner IDs
  must match an **independently verified** owner mapping.
- Historical Appwrite task IDs can be longer than candidate task IDs.
  A link's `taskId` is preserved up to the original schema maximum (255);
  forcing a 36-character future task ID would silently lose history.
  **A long original task reference is quarantined, not imported as ready,**
  until a separately verified target-ID mapping preserves its meaning.
  No cross-owner relationships are ever allowed.
- `classifyCandidateLinkReferences` returns **ready**, **quarantined** or
  **tombstone** given the signed owner's complete source target inventory.
  Missing, foreign or deleted linked tasks/bucket items are *quarantined*,
  NOT auto-deleted or silently rewritten; intentional link tombstones stay
  tombstones. Existing data should remain in a private export/ledger until
  every target is accounted for.

## Required before hosted or public acceptance

Implement two reviewed private SQL tables, authenticated owner-only
RLS, expected-change-revision CAS, owner-linked referential guards and
signed local GoTrue two-owner/foreign-negative tests. Decide how to represent
historical dangling/task-ID references without violating owner isolation,
then extend encrypted database/Auth/Storage offsite capture and isolated
restore profile to all ten personal data tables, including task links.
Add owner-scoped pull/create/CAS, RxDB checkpoints and conflict reviews;
prove full ZIP/offline/reimport parity and a fenced, reversible provider
migration. **Never apply a hosted schema before full data DR coverage.**
No further Fedora command until the full one-pass pre-social bundle.

## Unapplied two-table SQL candidate (draft; NOT accepted)

The isolated source branch stages `supabase-poc/migrations/20261025_candidate_private_bucket_links.sql` with owner-private Bucket List and ready task-link tables, composite (owner, target ID) foreign keys, authenticated owner-only read/create RLS, writer-lease/revision triggers, and strict expected-revision CAS for mutable fields only. No direct client UPDATE/DELETE and no reference redirection are granted. The accompanying catalog assertions are source-only until executed against disposable PostgreSQL.

The 255-character historical Appwrite task references are not coerced to candidate task IDs; incomplete, foreign, deleted, or long target references **must** remain in an external encrypted quarantine inventory during any future import. That quarantine/export replay is not implemented here. A link cannot be inserted as ready unless its same-owner bucket and task already exist and are non-deleted, with compatible IDs. Core App CI now installs these files into a **disposable local** Supabase database and runs owner/RLS/catalog/CAS/lease/tombstone negative tests. **These tests are not accepted without an exact green CI run.** The separate ten-table age-encrypted exact-byte source-to-independent-target recovery profile is still missing; no hosted schema or application writer may be enabled.

## Strict protection of historical encrypted restore modes

The disposable restore parser now rejects either new Bucket List / link TABLE DATA object under the six-table historical, fresh seven-table Diary, or eight-table Settings profile. It also rejects any other unexpected `public.mosaic_candidate_*` TABLE DATA object instead of silently dropping future user data. Two new Python cases cover each old mode and previously unknown personal tables, bringing that guarded restore contract to eleven cases. This protection **does not** implement a new ten-table recovery mode: the full signed ten-table source/archive/independent-target gate, matching uploader profile, exact COPY row parity and completed R2 object format remain required. Old accepted R2 snapshot bytes and their native retention lock are unchanged.

## Draft disposable ten-table recovery (dependent, not yet accepted)

A second isolated source branch introduces an explicit ten-object recovery choice (the four Auth/authority items plus categories, tasks, Diary, Settings, Bucket List and task links). It requires an exact fresh encrypted archive SHA; invoking six/seven/eight modes with new Bucket/link data still fails closed. Neither this source choice nor the earlier archive proof authorizes recovering user data under a wrong profile.

The separate `supabase-ten-table-restore.yml` workflow uses disposable GitHub PostgreSQL 17 / GoTrue identities to seed all ten tables with real signed owner sessions, achieved Bucket data, ready links and a link tombstone. Its source is encrypted with `age`; the authenticated original-archive TOC and explicit `ten-personal-bucket-links` inventory gate must pass, along with seven/eight downgrade rejection. The restore runner builds a **new isolated target** and compares exact per-table COPY bytes and row counts before allowing original-password signed owner readback, foreign-owner denial, CAS non-mutation and tombstone/revision verification.

**Status:** implementation source exists; exact workflow success has not been confirmed. No hosted Supabase schema was applied, no R2 ten-table snapshot created, and no production/Preview writer enabled. This disposable database/Auth proof is **not** a complete R2/Storage/attachment backup, ZIP/import parity, account mapping, or cross-provider reversibility acceptance.

## Signed Bucket List/link incremental READ adapter (source-only)

The existing owner-signed, session-epoch-fenced candidate HTTP change transport
now recognizes `buckets` and `bucket_task_links` as **read-only** domains.
`pullCandidateBuckets` and `pullCandidateBucketLinks` validate every returned
owner, source field, deleted tombstone and strictly increasing `bigint` server
revision before yielding any advanced checkpoint. Requests include the exact
Supabase Auth owner filter, ordered revision cursor and bounded page limit.
Malformed/foreign/duplicate/out-of-order rows, session replacement, invalid
identities and oversized pages refuse the entire batch. Six isolated unit
regressions prove contract behavior using injected HTTP responses; they do not
prove hosted signed SQL or activate RxDB replication.

A signed same-owner link row is **not by itself migration authorization**:
`classifyCandidateLinkReferences` still requires complete independently
verified Bucket and task target inventories, and missing/deleted/foreign/long
references are retained in quarantine for review. Do not attach the new read
adapter to the shipped Appwrite shared collections or enable writes before
signed ten-table disaster recovery and tested provider fencing.

## Source-only owner Bucket List CREATE/master and CAS transport

The isolated candidate transport now validates an independently supplied
legacy-owner-to-Supabase-owner map, reads owner-filtered current master, and
creates Bucket goals and task links only with a signed session and no upsert.
A duplicate INSERT performs a new signed owner master read; inaccessible or
malformed conflicts cannot be acknowledged. Link CREATE demands original
short IDs, an explicitly reviewed complete owner target inventory and a
ready/tombstone classification. Missing, foreign, deleted-active and
unrepresentable historical references are **not** written and remain eligible
for the external private quarantine ledger (which is still unimplemented).
Even a tombstone link requires known same-owner target identities.

The strictly allowlisted owner revision CAS RPCs support Bucket title,
description, achieved state/date, updatedAt and logical deletion; links
support only updatedAt and deletion. Caller-supplied immutable Bucket/task
reference IDs must match the returned master after link CAS. Forbidden
owner/reference/revision patches, bad timestamps, stale or typed-null
conflicts and in-flight account replacements are refused. The
`supabaseCandidateBucketCreateCas.test.ts` fixture covers these source-only
contracts without cloud writes. No code activates the live Mosaic RxDB
provider, hosted Bucket SQL, Appwrite dual writers or imports unknown links.

**Still required**: exact green focused Quality and disposable signed SQL,
PG17 ten-table encrypted restore, owner-scoped RxDB checkpoint/backfill with
blocked conflict reviews, complete ZIP/media replay and bidirectional
single-writer provider migration; held Production approvals remain.

## Signed remote-link length boundary and stacked branch reconciliation

The historical source mapper intentionally permits original Appwrite task
references up to 255 characters for lossless export. The **remote Supabase
candidate** contract does not: a signed remote link with a task reference
longer than 36 characters must be refused **before a pull checkpoint advances**
or an owner master is acknowledged. Both new read and master paths enforce
this boundary and include malformed remote-response tests. Historical source
records remain intact for a later private quarantine process.

The late owner-first SECURITY DEFINER lookup fix from draft #1328 has been
reconciled through the dependent #1329 and #1330 **task branches** via internal
PRs #1331 and #1332. Those internal merges do not accept #1328/#1329/#1330
into stable recovery or authorize any hosted database, Preview or Production
release. Final exact CI evidence remains mandatory before acceptance.

## Isolated Bucket List and task-link RxDB replica (source only)

`candidateRxdbPilot.ts` now accepts `buckets` and `bucket_task_links`
for explicitly constructed **isolated** RxDB collections. It never starts
either domain in shipped Mosaic or the current core Supabase bridge. Pull
uses signed owner-only pages, native durable RxDB `bigint` checkpoints and
logical `isDeleted` tombstones (not physical RxDB deletion). Push performs
a session/epoch fence around signed master reads, no-upsert creates and
revision CAS; immutable creation dates and original task/bucket references
cannot be changed, and divergent edits remain parked for explicit review.
No timestamp-based master overwrite is silently accepted.

Task-link writes require a caller-supplied independently reviewed **complete**
owner target inventory on every push attempt; absent, foreign, deleted-active
or >36-character historical target IDs are quarantined rather than
shortened, retried blindly or acknowledged. Even tombstone links must
reference known same-owner targets. Asynchronous inventory lookups are
followed by a new signed session check; logout/account switching fails
closed. CAS supplies the original two target IDs and refuses a response
with changed references. Starting a task-link replica requires the target
inventory callback; specifying a collection is not sufficient.

Unit tests cover positive owner create, update, signed revision pull, original
reference integrity, tombstone replay and rejection of foreign, missing,
invalid, long and account-switched targets. This code is not a verified
historical-data migration or a hosted writer. Before enabling it, first
stage and verify owner-specific target inventories, durable encrypted
quarantine, offline/restart/cross-device convergence, provider-exclusive
authority and private media/ZIP recovery.

## Signed historical link inventory classification (source-only)

`candidateBucketHistoryAudit.ts` accepts only a *complete*, separately
verified one-owner list of task identities, Bucket goals and **all** links
(including deletion tombstones), together with independently obtained exact
owner record counts. It rejects foreign-owner rows, duplicate source IDs,
malformed references, incomplete counts and excessive inventories before
returning any classification. Output preserves each original link ID, owner,
reference, timestamp and deleted flag without rewriting its task ID.

The three dispositions are ready, tombstone and quarantined. Active links
whose owner targets are absent or deleted, links with historical task IDs
longer than the 36-character Supabase target, and even tombstone links with
missing targets are retained for quarantine. A foreign *reference* appears
only as missing from the owner-only target inventory; the audit never fetches
or includes another owner's record. Deterministic output order allows
independent comparison; the module does not serialize, encrypt, save, upload
or import any private rows. Ten unit tests cover source-owner limits and
non-lossy classification.

**Not yet complete:** the operator must supply a signed, full owner-history
source snapshot and counts (the active-only user ZIP is insufficient), bind
those to an independently authenticated encrypted archive digest, write and
authenticate a private encrypted quarantine ledger, replay it with matching
owner target mappings, and prove exact link count/hash parity after a
two-provider reversible migration. This module must never be mistaken for
the durable encrypted ledger or actual migration tool.

## Offline age-encrypted owner link history (source-only synthetic proof)

`packOwnerBucketHistory` constructs a deterministic, allowlisted
`mosaic-owner-bucket-link-history` v1 envelope from the complete verified
owner records: it includes the exact previously authenticated encrypted
source SHA256, source counts, owner mapping, target-identity digest and **all**
original links (including tombstones and quarantined long/dangling IDs).
Only declared link fields are included; unexpected attributes never enter
the export. This is NOT itself proof the input source was authenticated:
the actual operator must independently verify the full source archive and
signed owner inventories.

The Node-only `encrypted-owner-history.mjs` takes that reviewed envelope
and an age X25519 recipient, requires an existing owner-owned private 0700
directory, streams plaintext only through memory/child stdin to the age
executable, checks its ciphertext header, fsyncs the 0600 temporary output,
then publishes via exclusive hardlink so an existing archive cannot be
overwritten. It returns only encrypted-byte count and SHA256, never link
contents or credentials. Failures clear the plaintext buffer and remove
temporary ciphertext. The disposable
`supabase-bucket-history-encryption.yml` lab generates a synthetic recipient,
proves real age encryption/decryption and exact preserved 255-character
references, and rejects foreign owner, malformed counts, invalid recipients,
missing binary and target overwrite without leaking private data.

**Not yet complete:** real signed full-history owner extraction, independent
source age/archive digest authentication, durable encrypted inventory
publication/retention, and independently verified replay/backfill across
Appwrite Cloud/Oracle and Supabase. No hosted schema/writer, R2 object,
Production or user ZIP semantics have changed.

## Source-only signed Appwrite full-owner read snapshot (2026-10-26)

`appwriteOwnerHistoryRead.ts` is a dormant, read-only collector for the
pre-social task-identity, Bucket and Bucket-task-link inventories. In
contrast to the active-only user ZIP, it queries all owner rows by
`user_id` (including `deleted=true`) using the guarded signed Appwrite
TablesDB and Account SDK surfaces, keyset paging by `$id`, an explicit
`total:true` count and bounded page size. It makes two independent,
complete pageset passes and refuses changed counts, shifted records,
duplicate/out-of-order IDs, malformed historical fields, foreign rows and
absent tombstone metadata. It includes exact original 255-character
Appwrite task references; it NEVER rewrites IDs, omits deleted rows,
persists a checkpoint, writes a database or calls the Supabase backend.

A caller must supply a **server-enforced read-only owner source lease**
with exact Appwrite endpoint, project, database and installation identity,
unexpired generation/lease IDs, plus the app's authenticated owner session
epoch. Both remote account verification and authoritative lease checks
run around every signed page, including both passes; an account switch or
an expired/changed lease invalidates the entire result. The actual lease
issuer/old-PWA server fence is *not yet implemented*. The caller cannot
self-authorize this via a local UI flag. Signed access alone cannot make
a concurrent-write snapshot consistent.

The result is a **preliminary readback**, not yet an independently
authenticated historical source archive: the task domain carries identity,
tombstone and count, not full task content; Appwrite's own pagination
`total` does not independently prove a frozen backend inventory. Only a
separately signed and authenticated full source snapshot (including task
content and media) may supply `packOwnerBucketHistory.sourceArchiveSha256`.
Unit tests use injected synthetic Appwrite responses and fail-closed lease,
owner, pagination, tombstone and two-pass-mutation cases. No real Cloud
or Oracle owner has been read or migrated.

The source reader also requires each lease's exact server-frozen owner row
counts for tasks, Bucket goals and links, distinct from the Appwrite
`listRows.total` value. All pages and both complete passes must agree with
this independently issued count witness; the lease and witness are copied
before scanning so a mutable callback cannot change the expected totals in
place. This does **not** make a browser-supplied fake lease authoritative:
the missing server-coordinated writer fence remains a hard blocker.

## Independently pinned offline age decrypt + quarantine readback

The source-only `verify-encrypted-owner-history.mjs` refuses any
unverified ciphertext without four independent hashes: exact age
ciphertext SHA256, decrypted original manifest SHA256, original full
source archive SHA256, and sorted owner target-identity SHA256. It also
requires the exact original owner mapping and complete owner counts.
Private 0600 encrypted archive and age identity must live in an
owner-owned private directory (no symlinks); the tool checks ciphertext
hash **before** age decryption, suppresses stderr, never writes
plaintext or emits link data, clears the decrypted byte buffer, then
validates sorted, unique, same-owner historical links and exact original
IDs, timestamps, tombstones and documented quarantine dispositions.

A green synthetic age encrypt+decrypt lab includes mismatched manifest,
owner/source, count and target fingerprints as well as an independently
re-encrypted duplicate-link archive: the latter MUST fail despite a
correct ciphertext and manifest checksum. This is a readback primitive
only; a genuine migration still needs separately authenticated
source-proof generation, retention of real ciphertext, target replay,
cross-provider owner mapping and authoritative writer freezes.

## Independent source-versus-restored Bucket/link field parity (source only)

`candidateBucketReplayParity.ts` accepts the authenticated complete-owner
source tasks/goal/link inventory, the separately pinned SHA256 of the
encrypted historical manifest, and two **already signed, owner-filtered and
fully paginated** target Supabase table snapshots. It reclassifies original
links using the source inventory and recomputes the full source manifest
digest before comparing any remote records.

Every owned Bucket goal, including tombstones, must appear exactly once
with unchanged original title/description, achieved state/date, IDs and
timestamps. Every ready/task-linked link and admissible soft-deleted link
must appear exactly once with unchanged original task and Bucket
references, owner, created/updated timestamps and tombstone state.
Quarantined long/dangling/deleted-target links MUST remain in the
encrypted historical source ledger and MUST NOT be silently imported
into the live SQL link table. Missing, extra, foreign, duplicate,
revisionless or modified remote target rows fail closed, including a
target that reports the correct total count but altered link references.
The result includes deterministic field SHA256 and match counts but
**always** reports `providerCutoverEligible:false`.

This is pure comparison code without networking or imported rows; the
caller still must prove signed two-owner target readbacks, writer
exclusivity, original complete source provenance, real encrypted
quarantine persistence, task/Settings/media parity and reverse replay.
It neither authorizes hosted Supabase writer installation nor makes a
Production provider switch ready.

## Complete original Appwrite personal source escrow (2026-10-26, source only)

appwriteFullOwnerSourceArchive.ts seals both owner-signed double-pass scanners into
one exact original source inventory: task content/tombstones and identity,
categories, Diary, Settings, Bucket goals, links (including 255-character
legacy dangling refs), original raw field presence/null and source ACLs.
It rejects owner, lease, generation, count, and content divergences, copies
rows before asynchronous escrow, and requires a separately pinned seven-reader
digest. A local digest alone is NOT independently signed source authority.

appwrite-full-source-archive.mjs encrypts the complete reviewed manifest into
one X25519 age archive; no plaintext is written. Requires private owned 0700
directory and exclusive 0600 output. Independent readback checks pinned
cipher/plain digests, exact owner/source/lease/generation, all original
row hashes and tombstones, then returns metadata ONLY. Bounded 64 MiB
plaintext inputs fail closed instead of truncated migration. A dedicated
real-age synthetic CI lab checks encryption, decryption, original tombstone
and long-link fidelity, old-file preservation, tampered and foreign rows.

This implementation does NOT read real Appwrite owners, freeze old PWA writers,
authenticate an actual trusted server signer, preserve image BYTES or finalize
encrypted R2 restore. It does not make Settings/Bucket hosted, implement replay,
authorize Supabase Production or execute a provider switch. Remaining live
R2/Storage, ZIP, quarantine and real bidirectional migrations stay separate.
Only ONE final full pre-social Fedora acceptance command after all automated gates.

## Offline original Appwrite private media BYTE escrow (2026-10-26)

The source-only Appwrite appwrite-original-media-age.mjs stages a complete,
independently pinned single-owner Storage inventory and exact original WebP
bytes into no-plaintext-file age X25519 ciphertext. It requires private 0700
directories, 0600 files, rejects symlinks, and validates owner IDs, expected
size/SHA256, extra/missing staged originals and original-file changes.
It publishes immutable 0600 no-overwrite ciphertext. Separate readback
checks pinned full ciphertext and decrypted plaintext SHA256, each file byte
digest/count, original Appwrite installation, complete seven-reader source
archive ciphertext SHA and original ACL witness SHA. Results contain metadata
only; no image bytes are returned.

The isolated real age lab uses THREE synthetic WebP-shaped originals including
an unreferenced orphan. It tests byte equality, preserved existing archives,
forged re-encryption, wrong owner/pins/digests, extra original staged files and
symlink rejection. No real user data or cloud API is accessed.

The source-only in-memory bound is 16 MiB original bytes and 32 MiB encrypted
plaintext input. Larger users must use a separately reviewed streaming capture,
not truncation or implicit passing evidence.

This does NOT authenticate actual source owner membership, issue a trusted
Appwrite writer fence, download originals, upload to R2, prove full DR,
migrate Storage to Supabase or authorize provider cutover. Input membership
and SHA pins must come from a separately authenticated complete source. The
owner still requires ONE final consolidated pre-social Fedora acceptance.

## Complete-owner Bucket replay partition (offline only, 2026-10-26)

`candidateBucketLinkReplayPlan.ts` now builds an exact owner-mapped,
deterministically ordered **offline import proposal** from a complete original
owner task/Bucket/link inventory and the already verified private age history
receipt. It requires independently pinned source-archive, encrypted historical
ciphertext and decrypted manifest digests; matches exact source owner counts,
target-identity fingerprints and original ready/tombstone/quarantined
dispositions before materializing any target rows. The proposal carries all
Bucket rows including tombstones, only representable ready/admissible-deleted
link rows, and private IDs/reasons/field hashes for every excluded link.
Quarantined originals themselves remain intact in the existing encrypted
historical source archive. The complete link count must equal proposed
writes plus quarantined references: no silent missing link or guessed
mapping is permitted.

Unit tests cover one-owner/foreign-owner boundaries, long/dangling/deleted
references, exact source/reference preservation, array-order invariance,
tamper and manifest/cipher/target-fingerprint/receipt mismatches, missing
data and unchanged source objects. This is an import **plan**, NOT an
authorized uploader, independently authenticated source provenance,
durable confirmed archive retention, actual SQL readback or real provider
migration; its cutover flag is explicitly false. Real source-authority
signing, old-PWA writer freeze, encrypted offsite quarantine retention and
reverse replay remain required. No hosted database change or Fedora action.
