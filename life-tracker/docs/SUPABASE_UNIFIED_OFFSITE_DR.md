# Supabase unified encrypted offsite recovery — source-only (#1027)

**Status (2026-10-25): verified protected Scratch R2 backup, independent watcher and exact-snapshot Fedora local restore PASSED. Recurring backup and pruning remain OFF.**
This adds **one completed recovery generation** for both Scratch `mosaic-dev`
PostgreSQL/Auth-row data and its full private `mosaic-personal-photos` object
inventory, analogous in scope to the Appwrite Function's data-plus-media snapshot.
It does **not** capture all Supabase-managed platform configuration, other managed
services or provider secrets, and is not a verified production disaster-recovery system.

## Snapshot contract

`supabase-poc/unified-offsite.mjs --backup` composes the two existing proven,
source-read-only snapshot producers:

- `hosted-encrypted-backup.sh`: full PostgreSQL custom-format dump including
  recoverable Auth users/password hashes, private candidate data, and schema
  metadata, age-encrypted on the runner. It requires a Scratch-only IPv4 **Session
  pooler** database credential and PostgreSQL **17** client.
- `private-photo-snapshot.py`: complete Scratch private photo-bucket inventory,
  immutable verified object bytes and an age-encrypted Storage TAR/manifest.
  It requires a **separate backend-only** Scratch Storage secret. No source writes.

Both producers independently authenticate their own age ciphertext locally.
The uploader then splits each encrypted archive into bounded 8 MiB chunks and
uploads to a dedicated R2 bucket under distinct `mosaic-supabase/v1/snapshots/
<id>/database/parts/` and `/media/parts/` namespaces. It downloads every
chunk to verify the SHA-256, rereads the source ciphertext hash and file
identity, and publishes **one single** metadata-only `COMPLETED` marker at
`mosaic-supabase/v1/snapshots/<id>/COMPLETED` **only after both archives pass**.
Failed/partial generations are never restore points. No private row/owner, photo,
password, age identity or database password is written in the R2 marker, GitHub
code or logs. The two source captures are sequential, not a single cross-service
transaction: the marker records their capture-start and completed timestamps.

`--watch` uses only a separate R2 read-only key and verifies every encrypted
chunk in **both** components, the root manifest and a newest-completed-age
threshold of 36 hours. `--download <id> /new/private/absolute-directory`
writes `database.age` and `media.age` with restrictive permissions into an
**absent** directory, fails if it already exists, and removes a failed partial
retrieval. The recovered archives must separately pass full authenticated age
inspection and **fresh isolated local PostgreSQL/Auth + Storage restoration**
with owner-signed privacy checks before any recovery may be called accepted.
Cloud R2 ciphertext-hash validation alone is NOT proof of decryption or restore.
Never point the restorative procedures at hosted Scratch or Production.

Optional retention is **OFF** unless separately approved. Pruning validates
**every** historical generation's exact complete object set, refuses orphan or
unknown objects, verifies the newest generation's entire remote bytes, and
preserves a provider-locked 30-day window plus at least 7 daily / 4 weekly /
6 monthly points. R2 bucket lock must cover `mosaic-supabase/v1/` including
both archives and root completion markers. Do not enable pruning until native
R2 lock is read back and independently tested. Failed captures can leave
orphan parts; investigate them rather than silently deleting them.

## GitHub runner PostgreSQL client preflight

The Ubuntu 24.04 runner ships PostgreSQL 16, so the disabled backup workflow
pins `ubuntu-24.04` and installs `postgresql-client-17` from PostgreSQL's
signed PGDG apt repository before starting the source capture. The source
entrypoint independently refuses a `pg_dump` or `pg_restore` client other than
PostgreSQL 17. The GitHub workflow emits a signed Deb822 `pgdg.sources` file with separate
`Types`, `URIs`, `Suites`, `Components` and `Signed-By` lines, installs only
the PostgreSQL 17 client, and checks both executable paths before reading
source credentials. Any package/key/source-format failure stops the workflow
without producing a `COMPLETED` recovery marker. The PostgreSQL 17 runner correction was successfully exercised in protected
Scratch Actions backup #40157401249, independently checked by read-only watch
#40166002937 and restored from the exact encrypted R2 generation on Fedora.

## Protected configuration — not yet independently verified or authorized

This is **one dedicated Supabase backup bucket in the same existing Cloudflare
R2 account as Appwrite**; it is not a second Cloudflare account. Appwrite's
`mosaic-dr/v1/` archive and encryption keys are not reused as Supabase secrets.
The earlier `mosaic-supabase-media/v1/` proof remains isolated/dormant and
must NOT be mistaken for this new unified restore point.

Both new GitHub workflows are **inert on this feature branch**. They require
separately approved placement on the default `main` branch, a restricted
`mosaic-supabase-dr` protected environment, and repository variable
`SUPABASE_DR_ENABLED=true` for jobs to run. Do not configure `main` or set the
enable flag without the separate release/production safety approval. Daily
backup runs at 12:00 UTC; independent byte-watch at 00:00 UTC. GitHub Actions
red status alone is not a delivered paging/notification channel.

Protected environment **secrets** (never paste them in ChatGPT):

- `SUPABASE_DR_PGHOST` — previously established Scratch-only IPv4 Session
  pooler host; `SUPABASE_DR_PGPASSWORD` — Scratch PostgreSQL credential.
- `SUPABASE_DR_SOURCE_STORAGE_KEY` — Scratch-only backend Storage `sb_secret_`.
- `SUPABASE_DR_AGE_IDENTITY` — independently escrowed age private identity.
- `SUPABASE_DR_R2_ACCOUNT_ID`, `SUPABASE_DR_R2_WRITE_ACCESS_KEY_ID`,
  `SUPABASE_DR_R2_WRITE_SECRET_ACCESS_KEY`,
  `SUPABASE_DR_R2_READ_ACCESS_KEY_ID`,
  `SUPABASE_DR_R2_READ_SECRET_ACCESS_KEY` — dedicated bucket-scoped tokens;
  watcher token must be **Object Read only**.

Protected or repository variables:
`SUPABASE_DR_R2_BUCKET` (the dedicated private R2 bucket),
`SUPABASE_DR_ENABLED=false`, `SUPABASE_DR_PRUNE_ENABLED=false`,
`SUPABASE_DR_R2_LOCK_CONFIRMED=false`. `SUPABASE_DR_SOURCE_PROJECT`
remains the **compiled-in** verified Scratch project in both workflows.
Use independent offline/password-manager escrow for the identity and
Source Recovery credentials; losing the provider plus all credentials is
not recoverable from ciphertext alone.

## Remaining release blockers

1. The source currently targets Scratch only, and needs an independent
   **real R2 → new loopback-only PostgreSQL 17/Auth/Storage** full two-archive
   restoration, positive original-password owner verification, foreign-owner
   denial, plus **real** user-photo restore once hosted Storage has photos
   (historically it held zero; a synthetic WebP was independently restored).
2. Confirm PostgreSQL custom dump recoverability after original managed schema
   setup. The existing seven-table successful recovery exercises its owned data,
   not an automatic full restoration of every managed extension, role, Auth/SMTP
   config, JWT issuer, externally managed secrets and OAuth settings.
3. Escrow non-secret and secret managed Supabase configuration separately,
   validate account-erasure/tombstone protections across old backup restores,
   and decide backup consistency while writes continue. No claim of
   point-in-time database+Storage transaction.
4. Validate alert delivery, R2 lock and account/cost retention, end-user
   task/diary/photo/browser offline and ZIP/device checks, Bucket List and
   synced-settings parity, old-PWA writer fencing and reversible providers.
5. Explicit approval for any protected Preview, dev, main, Production or
   live scheduling changes. None is granted by source-only PR acceptance.

The current complete one-command Fedora drill is **already proven** for the
previously accepted PostgreSQL/Auth, empty hosted bucket and nonempty synthetic
Storage case. Do NOT demand a repeat of that historical drill to validate only
new source. The *new combined-R2 restore* is a separate unperformed gate.

## Operator-reported setup checkpoint (2026-10-25)

The owner reports completing the dedicated R2 bucket, 30-day bucket-lock rule,
two bucket-scoped R2 tokens and `mosaic-supabase-dr` protected GitHub
environment/variables. The current GitHub connector lacks environment-secret,
Actions-variable and Cloudflare-bucket administration/read access. Therefore
this configuration has **not** been independently verified; do not infer a live
successful backup or matching secret values from the owner's setup report.
Keep `SUPABASE_DR_ENABLED=false`, pruning disabled and the backup workflows off
`main` until separately authorized and verified.

## Independently restoring the exact 2026-10-25 completed R2 snapshot

The protected main-branch manual backup (Actions run #40157401249) and
read-only byte/freshness watcher (run #40166002937) both PASSED for the same
immutable recovery ID: `20261025T031343499Z`. This does **not** prove
decryption or independent restoration. The separate existing historical Fedora
drill restored a different directly captured archive and should not be repeated
as a substitute for this exact-R2 acceptance.

The newly reviewed source-only `supabase-poc/restore-unified-r2.py` orchestrates
one *local trusted Fedora* invocation. It reuses only the existing private
`~/.config/mosaic/supabase-backup.agekey`, `~/mosaic-secure-backups`,
Docker/Supabase CLI, and existing proven local recovery/GoTrue/Storage drivers.
It does **not** require the hosted PostgreSQL password or live Storage
backend secret, and performs no hosted Supabase writes or additional backups.

**One operator command**, after the checked-in restoration driver has passed
the accepted branch's CI:

```bash
bash -o pipefail -c 'repo="$HOME/mosaic-photo-dr-review/life-tracker"; git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && sha="$(git -C "$repo" rev-parse FETCH_HEAD)" && git -C "$repo" show "$sha:life-tracker/supabase-poc/restore-unified-r2.py" | python3 - --run --source-sha "$sha"'
```

Enter the Cloudflare R2 account ID plus the **dedicated Supabase bucket
read-only** Access Key ID and secret privately at the tty. Do not use
Appwrite's token or a write token, paste secrets in chat or commit them.
The runner uses the existing protected Git checkout and exact FETCH_HEAD
SHA; it verifies source identity, R2 bucket, and the literal completed ID
before accessing only the encrypted R2 objects. It preserves a no-clobber
0600 ciphertext pair in a newly created private 0700 directory, verifies
each age ciphertext **in full** plus required DB/Auth TOC, creates a NEW
loopback-only disposable PG17/GoTrue/Storage target, restores seven
allowlisted data tables with exact original-source/target row bytes,
then prompts for an existing populated owner's email/password for fresh
local sign-in and owner/foreign isolation. It restores the entire R2 media
archive into that **local** target; when real media inventory is zero, it
also proves nonempty synthetic WebP encryption/restore rather than pretending
to have restored hosted user media. It stops only that disposable local stack,
removes its bridge/worktree and never touches hosted Scratch or Production.

Required final marker:
`MOSAIC_R2_EXACT_SNAPSHOT_DISPOSABLE_RESTORE_PASS: 20261025T031343499Z`.
A partial success cannot count as full DR acceptance. On failure the runner
prints a sanitized failed-stage marker; inspect the private target on the
trusted machine without transmitting credentials. The ciphertext evidence
remains encrypted and outside Git. The runner's offline Python test covers
successful orchestration, wrong age identity, R2 integrity mismatch, failed
local login and media failures with cleanup, in addition to strict key/source
preflight. The operator independently ran the exact SHA-pinned Fedora command and supplied
successful stage 01-07 logs and the final exact snapshot disposable restore
PASS marker (R2 generation 20261025T031343499Z). This proves only the covered
Scratch data recovery, not all managed platform services.

The following remain separate release gates regardless of this result:
managed Supabase Auth/SMTP/OAuth/JWT configuration DR, live photo-bearing
owner byte restore once photos exist, native bucket lock/credential escrow
proof, delivered alert test and an explicitly approved recurring schedule.
Keep `SUPABASE_DR_ENABLED=false` and pruning disabled until those gates.

## Remaining safeguards: provider-native lock and delivered failure alert

The exact offsite snapshot 20261025T031343499Z has already passed encrypted
upload, independent reader-byte watch and a real isolated Fedora restore.
Do NOT repeat that accepted recovery drill solely for these safeguards.
Provider-native lock readback, independent key/password-manager escrow
and actual mailbox alert receipt have NOT yet been proven. Keep recurring
backup, retention pruning and the lock-confirmed variable disabled.

### Provider-native Cloudflare R2 lock audit (strict GET only)

Cloudflare bucket lock API reference:
https://developers.cloudflare.com/api/resources/r2/subresources/buckets/subresources/locks/methods/get/

The isolated-source auditor supabase-poc/r2-lock-audit.py uses only GET
against the exact dedicated Cloudflare account/bucket lock endpoint.
It requires an enabled Age >= 2592000 seconds (30 days) or Indefinite
rule that applies to ALL current and future mosaic-supabase/v1/snapshots/
objects, including completion markers and both archives. Disabled,
shorter, one-snapshot-only or Date-only rules are rejected.

The operator may run ONE exact Git-fetched source-pinned command on
trusted Fedora after branch CI acceptance:

```bash
bash -o pipefail -c 'repo="$HOME/mosaic-photo-dr-review/life-tracker"; git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && sha="$(git -C "$repo" rev-parse FETCH_HEAD)" && git -C "$repo" show "$sha:life-tracker/supabase-poc/r2-lock-audit.py" | python3 - --run'
```

It privately prompts for the Cloudflare account ID and a distinct
Cloudflare account API token allowed to inspect R2 bucket configuration.
Existing R2 S3 Access Keys CANNOT read the Cloudflare configuration API;
do not paste any token into chat or repository. Success reports
MOSAIC_SUPABASE_NATIVE_R2_LOCK_30D_READBACK_PASS.
No DELETE, PUT, rule edit, upload, overwrites or mutating proof are
performed: this is a native readback, not a destructive deletion-denial test.
The age identity successfully decrypted the complete encrypted archive on
Fedora, but independent offline custody and recovery access after loss of
Cloudflare/GitHub accounts remain administrative escrow checks.

### Brevo failed-run delivery (not yet active)

supabase-poc/dr-alert.mjs is a source-only fail-closed Brevo SMTP API
transactional notifier for the TWO exact main-branch Scratch unified
encrypted backup and independent full-byte watch workflows. It accepts
only trusted GitHub completed workflow_run events whose repository,
main branch, workflow name, expected run URL and failure/timed_out/
cancelled conclusion all match. Success/unrelated/fork events are ignored.
No user row/media data, passwords or tokens enter the alert payload.
The --probe option needs explicit TEST_SCRATCH_DR_ALERT confirmation;
it sends a distinctly labeled synthetic test WITHOUT causing backup failures.

Before enabled deployment, provision protected mosaic-supabase-dr GitHub
secret SUPABASE_DR_ALERT_BREVO_API_KEY and protected alert sender/recipient
settings SUPABASE_DR_ALERT_SENDER and SUPABASE_DR_ALERT_RECIPIENT.
Never commit these values. One verified active Mosaic Brevo sender exists,
but the intended alert inbox and actual receipt are NOT confirmed.
A future narrow, protected main workflow must pin an exact accepted source SHA,
use only those environment secrets, and validate source workflow identity.
Brevo HTTP 201/202 is just provider acceptance, NOT delivered email proof.
Independently confirm actual inbox receipt, unsubscribe/suppression/bounces,
retry/escalation and failure behavior before calling alerting reliable.
Workflow-red alone is not an externally delivered alarm.

No new active main alert workflow is installed in this source-only task.
There have been zero live test emails and zero R2 objects deleted.
Any main integration, protected secret changes, automatic schedules or
pruning require their respective explicit approvals and acceptance gates.

### Reviewed default-branch delivery workflow (not yet promoted or enabled)

The source-only `.github/workflows/supabase-full-offsite-alert.yml` is
prepared on the isolated recovery branch, not main. GitHub's documented
`workflow_run` completed trigger only works once a workflow exists on
the default branch:
https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#workflow_run

Its privileged job checks out **only** the already-tested immutable
`1b84c2b66bf0d90170a7b1bafed21dcdd1fd4199` alert implementation,
without persisted checkout credentials, and runs in the protected
`mosaic-supabase-dr` environment with only `contents: read` permissions.
It never executes the triggering run's code, artifacts or cache. The
`workflow_run` path needs protected
`SUPABASE_DR_ALERT_ENABLED=true`; leave the flag undefined/false until
a delivered mailbox probe succeeds. The `workflow_dispatch` path permits
ONE explicit `TEST_SCRATCH_DR_ALERT` synthetic test regardless of that
flag, on `main` only, after the protected secrets have been configured.

Before any promotion: owner must separately approve the narrow
stable→dev→main workflow rollout (main rebuild possible). GitHub
`mosaic-supabase-dr` must contain Brevo secret
`SUPABASE_DR_ALERT_BREVO_API_KEY` and two protected variables
`SUPABASE_DR_ALERT_SENDER` (verified active sender) and
`SUPABASE_DR_ALERT_RECIPIENT` (private intended alert inbox).
Never include addresses or API keys in the repository or in chat.
After this workflow is installed on main, run the synthetic probe through
GitHub Actions, verify returned `MOSAIC_SUPABASE_DR_ALERT_PROBE_ACCEPTED_NOT_DELIVERY_PROOF`,
then independently check the actual inbox and provider delivery logs.
Only then separately approve enabling automatic failure alerts.
Keep `SUPABASE_DR_ENABLED=false`, pruning disabled and Production backend
unchanged. This notification workflow does not itself fix missed backups;
daily schedule and a future failure-delivery escalation require acceptance.

### Proton reply address without Gmail — vendor constraint (2026-10-25)

The owner confirmed ONE genuine test delivered into Proton when Brevo
rewrote a verified Gmail sender into a managed Brevo domain. A Proton
sender→Proton recipient test previously showed Delivered/First opening in
Brevo but never appeared in the Proton mailbox. Proton was willing to accept
an authenticated Brevo-managed From; **do not** infer that a raw Proton
From can be spoofed safely. The owner approves managed Brevo From and
Proton Reply-To, and explicitly does **not** want Gmail dependence.

`supabase-poc/dr-alert.mjs` now supports an *optional* protected environment
variable `SUPABASE_DR_ALERT_REPLY_TO`. When set to a well-formed Proton
address it adds Brevo's standard `replyTo` object to the transactional JSON
without modifying `sender` or `to`. Malformed values fail before a request;
no email addresses or secrets are logged. Absent value retains existing
behavior. Brevo reference:
https://developers.brevo.com/reference/send-transac-email

**This is source-only; the accepted default-branch workflow is SHA-pinned
to the previous version and DOES NOT yet use the change.** Before any
release, verify a sender address independently provisioned and authorized
by Brevo. Do **not** simply fabricate `@brevosend.com` or attempt to
verify one: Brevo's sender creation requires access to the address to receive
an OTP. Its Gmail sender rewrite is automatic, not a user-owned mailbox.
The missing vendor decision is whether Brevo can force equivalent managed
sender replacement for a VERIFIED Proton sender in their transactional API.
Ask Brevo support with PRIVATE sender/event timestamps, without including
mailboxes or message IDs in public GitHub:
https://help.brevo.com/hc/en-us/articles/360020434360-Contact-the-support-team
If unsupported, no $0 proven no-Gmail Brevo-managed sender configuration
exists yet; preserve existing safe default and revisit another authorized
provider. Paid Proton SMTP/custom-domain/Bridge is outside the user's
zero-cost requirement.

Once supported, obtain explicit approval for narrow alert-source pin and
protected GitHub workflow env-variable change, run ONE labeled synthetic
test into Proton and require **owner-confirmed inbox receipt** before
enabling `SUPABASE_DR_ALERT_ENABLED=true`. The prior successful Gmail
sender test does not prove the agreed Gmail-free sender route; scheduled
backup and pruning remain disabled.

## Future personal data completeness gate — isolated source, no hosted changes

Before future hosted Settings writes or a new production unified offsite
generation, `unified-offsite.mjs --backup` now completely authenticates
`database.age` with age and independently inspects the PostgreSQL 17 TOC
**before** any private Storage read, R2 ciphertext upload or `COMPLETED`
publication. The TOC must contain exactly the three personal candidate
TABLE DATA entries (tasks, categories, Diary) for the historical/default
`seven` restore mode. This preserves the already successful October 25
seven-table snapshot and allows a future seven-table capture while hosted
Settings has not been installed.

When actual Settings TABLE DATA appears, `seven` **fails closed** rather
than publishing a falsely restorable seven-table marker. A distinct
reviewed, opt-in `SUPABASE_DR_RECOVERY_PROFILE=eight-personal-settings`
is then required, with all four tasks/categories/Diary/Settings TABLE DATA
entries. Unknown candidate collections (such as future Bucket List or task
links), duplicate or incomplete manifests are rejected under both modes
until the encrypted full-restore allowlist includes them. New completion
markers explicitly bind `recoveryProfile`; historical v1 markers without
the field remain readable and verifiable as historical ciphertext.

**No default branch workflow or hosted secret/variable was changed**, so
`SUPABASE_DR_RECOVERY_PROFILE` is currently unset and existing operational
backup and prune flags stay false. This guard does not itself restore R2,
authorize a hosted Settings SQL migration, or prove a future live eight-table
R2 restore point. The signed disposable age-encrypted eight-table restore
lab is separately green. All added code is isolated source only; the
owner's next Fedora handoff remains ONE complete pre-social acceptance run
after all personal domains and provider portability are implemented.

## Draft ten-table personal Bucket/link R2 profile — UNACCEPTED

The source-only `ten-personal-bucket-links` profile requires **both** reviewed
Bucket List and task-link TABLE DATA entries, plus the previously required
Settings/Diary/task/category and core Auth/authority inventory. Existing seven-
and eight-table recovery profiles refuse these extra data entries rather than
publishing or restoring a silently incomplete archive. A dedicated disposable
PostgreSQL 17 encrypted source-to-target laboratory test is defined in
`.github/workflows/supabase-ten-table-restore.yml`. It must complete green
against its exact accepted SHA before this new profile can be considered
recoverable. The test is not evidence of a new real-world completed R2
generation, nonempty private-media recoverability, or the external operator
one-pass approval. The hosted source has not received the Bucket/link tables;
do not enable the new R2 profile, any automated backup schedule, or pruning.


## Ten-personal-table unified R2 publication contract (2026-10-26)

The previous unified offsite publisher accepted seven- and eight-table TOC
profiles, but **rejected a ten-table recovery marker after encrypted objects
had already uploaded**, because its marker verifier lagged the distinct
`ten-personal-bucket-links` restore profile. The profile acceptance list now
shares `recovery-profile.mjs`'s exact exported identifiers. Synthetic R2
publication tests require one paired database+private-media `COMPLETED` marker,
full remote encrypted-byte verification, complete download, correct ten-table
profile readback, and failure on invalid profile or damaged archive manifest.
Old historical markers remain readable.

**This is backup-format support only.** Hosted `mosaic-dev` still lacks Settings,
Bucket List and task-link tables. A new ten-table live snapshot is not certified
merely by source CI: a separately protected fresh seven-table pre-migration
capture + independent full restore, followed by owner-approved hosted SQL and
a new ten-table whole-source/Storage R2 generation + independent full restore
are still required. Never enable scheduled backup or pruning by accident.


## Exact-generation isolated R2 restore for new personal profiles (2026-10-26)

The previously accepted one-command private `restore-unified-r2.py --run`
continues to restore the immutable October 25 seven-table snapshot by default.
To validate a **newly published** pre-change seven-, eight- or post-install
ten-table generation, the same operator-only runner now requires an explicit
completed immutable `--snapshot-id` and `--recovery-profile` pair, never
just one. The private R2 reader downloads exactly that completed marker's
**two** authenticated ciphertext streams; it compares the verified R2
completion marker profile to the requested profile BEFORE any decryption or
local SQL restore. Wrong, missing or malformed generation IDs, unsupported
profiles and attempts to relabel the historical snapshot fail before data
restore. All source+media age bytes are then independently authenticated,
and the previously reviewed dedicated 7/8/10-table restore flags enforce
**exact** source table inventory and COPY byte parity on a new loopback-only
PG17/Auth/Storage stack, with original-password owner and foreign-owner
negative checks. The environment remains stripped of hosted credentials;
private R2 read-only keys are still prompted on Fedora, and all disposable
stacks are cleaned. An offline test rehearses all selection, integrity, denial
and cleanup paths; the real independent external recovery remains an
unperformed rollout prerequisite.

No command is requested from the operator at this source milestone; complete
automatable protected backup/hosted checks first, then consolidate the final
full personal-data Fedora acceptance into ONE verified invocation. No new
hosted data, R2 objects, Production, or schedules were created.


## 2026-10-26 actual Fedora seven-table R2 restore stage-04 failure — fail closed

Actual fresh R2 generation `20261026T121358327Z` passed protected full paired
ciphertext backup publication, independent R2 watcher, and trusted Fedora
stages 01-03 including full age authentication. Stage 04 isolated local PG17
restore failed; stage 07 cleanup passed. The current evidence does NOT prove
a recovered PostgreSQL/GoTrue/Storage state; do NOT install hosted SQL yet.

The original outer runner suppressed all subprocess logs, properly avoiding
leaking private account rows and secrets but hiding the failure's substage.
The new source emits ONLY a fixed enumerated, non-sensitive checkpoint for
isolated Docker guard, loopback stack initialization, local schema, exact
archive manifest, Auth data restore, owner rows, and byte parity. The outer
wrapper never displays raw local child stdout/stderr and refuses unknown stage
labels. Inherited restoration mode variables are scrubbed to prevent stale
shell configuration from leaking extra authorization into the subprocess.
This is a diagnostic addition, NOT a claim to have repaired the unknown
underlying failure; actual independently restored owner login+media proof
still must pass on Fedora before deploying the approved `mosaic-dev` DDL.


## Read-only R2 credential prompt safety, 2026-10-26

A real retry of the same fresh generation `20261026T121358327Z` failed at
stage 02 **before network download** because at least one of the three private
Cloudflare R2 reader prompts did not meet the pre-existing format checks.
The underlying generic message did not distinguish the account ID, the
read-only **S3 Access Key ID**, or the **S3 Secret Access Key**. The reader now
reports only which field failed in a constant safe error. It never reports
values, length, raw terminal text or SQL/age credentials. The three fields
must come from the SAME dedicated R2 read-only S3 credential set; a
Cloudflare API token is not an S3 Access Key ID or Secret. Hidden keys must
not be pasted with surrounding spaces. The previous successful authenticated
R2 download remains valid evidence; no new snapshot, schema action or old
positive check should be repeated solely to resolve a prompt typo. The
Stage 04 physical restore remains unverified until a future operator pass.
