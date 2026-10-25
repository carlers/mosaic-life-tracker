# Supabase unified encrypted offsite recovery — source-only (#1027)

**Status: newly implemented source, DISABLED, not independently restored from R2.**
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
without producing a `COMPLETED` recovery marker. This repository-only correction
has not executed a hosted R2 backup; an actual Actions runner installation
still needs first-live-run proof.

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
preflight. The local real test is **not** yet performed by CI.

The following remain separate release gates regardless of this result:
managed Supabase Auth/SMTP/OAuth/JWT configuration DR, live photo-bearing
owner byte restore once photos exist, native bucket lock/credential escrow
proof, delivered alert test and an explicitly approved recurring schedule.
Keep `SUPABASE_DR_ENABLED=false` and pruning disabled until those gates.
