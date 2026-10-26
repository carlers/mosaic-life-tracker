# Supabase private media encrypted offsite recovery (#1027)

**Status: source-only, disabled.** This protects the *isolated Scratch* `mosaic-dev`
private `mosaic-personal-photos` Storage bucket only. It is not a Production
schedule, user photo recovery completion, managed Auth backup, or a provider cutover.

## Architecture and integrity boundary

`supabase-poc/private-media-offsite.mjs` invokes the existing audited
`private-photo-snapshot.py` as an isolated child. The Python snapshot lists
all owner folders with fixed Scratch origin, enforces allowed paths/size and
stable dual inventory, streams an age-encrypted tar/manifest to a 0700
runner-only directory, and verifies the whole age ciphertext with a 0600
private identity **before** the Node uploader can publish it.

The uploader sends only 8 MiB-or-smaller **encrypted** ciphertext pieces to
R2 (`mosaic-supabase-media/v1/snapshots/<UTC-ID>/parts/`). Each upload is
retrieved and SHA-256 verified. Source file metadata and a second complete
source SHA-256 read must still match before a marker may be published. A minimal, metadata-only `COMPLETED` object
with ordered part digests, aggregate ciphertext checksum, exact Scratch
identity and timestamp is written **last** and independently read back.
Uncommitted prefixes are never restore points. If source, upload or verification
fails, exit nonzero and never prune; orphan ciphertext is retained for operator
triage. The newest completed snapshot is checked each day by a separate
read-only watcher which downloads **every encrypted chunk**, recomputes all
SHA-256s and rejects snapshots older than 36 hours. The archive's *age*
authenticity is rechecked by the existing restore path on the trusted recovery
host; a remote ciphertext digest alone is not a decrypt/restore drill.

The `--download <UTC-ID> <new-absolute.age>` operation reconstructs verified
ciphertext to a 0600 no-clobber local file. It and read-only `--watch` remain
available with R2 read-only credentials even if backup scheduling is disabled;
a disaster cannot require re-enabling the writer. Subsequently run the existing
`restore-private-photo-snapshot.py` against an **independently provisioned new
loopback-only Supabase target** under the one-command DR protocol. This tool
never uploads any recovered bytes to hosted Scratch and cannot modify target
Auth/SQL. Nonempty real-photo recovery and signed device rendering remain
separate acceptance gates.

## Protected configuration — NOT applied automatically

Two dormant GitHub Actions workflows provide UTC 12:00 daily encrypted capture
and UTC 00:00 daily independent freshness/byte watcher. GitHub schedule runs
only from the default branch; these workflows remain inert on the isolated
recovery branch. Both require repository variable
`SUPABASE_MEDIA_DR_ENABLED=true`, exact `main` ref **and** an explicitly
branch-restricted `mosaic-supabase-media-dr` Actions environment. Do **not**
create or enable those on Production/main without separate explicit approval
and verified source/target R2 provider configuration. For unattended schedules,
the environment must be restricted to the main deployment branch but must not
require a human approval on every scheduled run.

Environment secrets, scoped **only** to that protected environment:
`SUPABASE_MEDIA_DR_SOURCE_STORAGE_KEY` (backend-only Scratch `sb_secret_`,
never public), `SUPABASE_MEDIA_DR_AGE_IDENTITY` (separately escrowed age
identity), `SUPABASE_MEDIA_DR_R2_ACCOUNT_ID`, distinct WRITE and READ
`SUPABASE_MEDIA_DR_R2_*_ACCESS_KEY_ID` / `*_SECRET_ACCESS_KEY` pairs. Repository
variable: `SUPABASE_MEDIA_DR_R2_BUCKET`. Each key must be bucket+prefix
least-privilege where supported; READ watcher should not have delete/write.
Never put values in files, issues, public workflow logs or Vite environment.
No keys were provisioned or tested live by this code change.

Retention reuses the existing Appwrite DR selection code (minimum 7 daily,
4 weekly, 6 monthly and all last-30-day snapshot IDs). **Deletion is disabled
by default**; only set `SUPABASE_MEDIA_DR_PRUNE_ENABLED=true` after reviewing
provider-level R2 prefix/bucket lock protection and setting
`SUPABASE_MEDIA_DR_R2_LOCK_CONFIRMED=true`. An incomplete, missing-part or unknown snapshot
object refuses pruning entirely; every historical committed marker and declared
part list is validated before deletion, and valid snapshots are deleted only after a
newest completed offsite restore point passes full-byte verification. R2
S3 Object Lock headers are not a supported mechanism on R2: set and inspect
native R2 bucket lock rules for the *whole* `mosaic-supabase-media/v1/`
namespace, not only `COMPLETED` markers; source-only code cannot enforce
provider retention policy. Check retention/delete permissions separately.
Cloudflare/Actions job failures must be wired to an independently tested alert
channel; a red GitHub Actions run alone is **not** a proven delivered alert.

## Gate before activation

1. Verify GitHub environment branch restrictions and initially approved enablement,
   isolated Scratch and dedicated backend-only Storage key; do not reuse
   Production Supabase or Appwrite secrets.
2. Verify external R2 encryption-ciphertext object lock, key escrow and a
   successfully authenticated nonempty encrypted backup in a protected lab.
3. Prove R2 corruption/incomplete-batch alarm and independent `--download`
   followed by signed restored private-photo GET/foreign denial with a
   disposable project. Test actual failure notifications.
4. Validate cost/usage, retention and recovery job limits; backup archive
   file size is bounded by 10,000 8MiB parts and runner disk/time. Periodic
   source dual inventory can fail under active writes; treat failure as
   alert-worthy, not as an empty backup.
5. Require separate approval for any `dev`, `main`, protected Preview or
   Production changes. Do not repeat previously accepted Fedora whole-bucket
   synthetic drill merely to accept a source-only scheduled workflow.

## Owner-wide historical photo reference/byte parity (source-only)

`supabase-poc/candidatePhotoMigrationAudit.ts` checks **all historical**
task `image` and Diary `photos` references, including soft-deleted rows,
against an independently captured complete original Appwrite owner Storage
inventory and a separately restored Supabase Storage object inventory.
It invokes the seven-domain owner history join first: signed identity,
Cloud/Oracle installation, source writer-freeze generation, content
fingerprints and task/link tombstones must still match. Every index must
have separately authenticated counts and externally pinned SHA256
metadata. The reader accepts only exact original file IDs and byte-size
and SHA256 claims, with expected target paths
`<Supabase Auth UUID>/<Mosaic file ID>.webp`. No public Storage URLs
are generated.

Every representable original owner blob, even if no current task/Diary
references it (e.g., an old avatar), must be restored byte-identically;
unexpected, foreign, duplicate, missing or changed target objects are
refused rather than deleted or overwritten. Original references with
missing Storage bytes or legacy IDs longer than the 36-character target
limit are **reported as unresolved**, never normalized or silently
removed from the independently encrypted source. Malformed historical
Diary photo JSON, duplicate photo IDs, and more than five photo IDs in
one entry fail closed rather than being truncated to five. The
result always includes `fullEncryptedSourceAuthenticated:false`
and `providerCutoverEligible:false`; matching metadata alone cannot
prove genuine binary provenance or enable a provider switch.

**Still required:** a real trusted Appwrite Storage/owner-count and
frozen-writer witness, independently authenticated original Appwrite
photo-byte archive, authorized owner mapping, actual Source/Supabase
encrypted Storage manifests and nonempty independent restore, signed
owner/foreign Storage tests, ZIP/offline/device replay and a safe
reverse-provider dry run. This comparator is no-network and source-only,
not a media migrator or an approved hosted backup job.
