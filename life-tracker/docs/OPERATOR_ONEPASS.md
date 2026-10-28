# Mosaic operator one-pass commands (#1027)

## 2026-10-28 Stage 03 diagnostics after accepted private PG17.11 bootstrap

The operator verified signed Fedora PG17.11 clients in a **private non-installed** directory (system Fedora PG18 untouched), then completed source/Docker and hidden-credential stages of the fourteen-table run. Stage 03 failed with only `GUARDED_CHILD_FAILED`; no completed fourteen-table marker has been proven. Existing ten-table BEFORE generation remains independently verified and must **not** be re-created. Do not assert R2 received zero writes: an unmarked partial generation is possible if the failed child reached publication.

The isolated source-only repair adds a fixed, enumerated safe failure checkpoint inside `unified-offsite.mjs --backup`: `SOURCE_GATE`, `R2_CONFIGURATION`, `WORKDIR_INIT`, `AGE_IDENTITY`, `PG_CLIENT_VERSION`, `PG_DATABASE_CAPTURE`, `PG_TOC_AUTHENTICATION`, `PG_TOC_PROFILE`, `STORAGE_CAPTURE`, `R2_PUBLISH`, `R2_FULL_READBACK`, or `R2_RETENTION`. The operator's parent accepts **only** an exact trusted stage code; never print subprocess stderr/stdout, SQL, owner data, keys or host paths. Only after R2 publishes and independently reads the paired `COMPLETED` root marker does it emit a recoverable exact snapshot ID. If verification fails after publication, the parent prints `MOSAIC_FOURTEEN_R2_ALREADY_COMMITTED_RETAIN` and must **not** republish: use that exact ID with the existing restore-only path.

Use the latest **canonical and specialist CI-accepted** isolated recovery SHA before one new trusted Fedora command. Its PATH must include both approved private PG17.11 wrapper executables. No package erasure, no altered system services, no weakened R2 or consent/Production fences.

## 2026-10-28 approved hosted fourteen-table identity state and operator-only R2 path

The owner expressly approved and the five reviewed additive migrations were installed
on **Scratch-only** `mosaic-dev` (`hcxtiifzxoaflhjgoglb`) with 21 verified migration
records. The four new private identity tables contain one installation, 87
canonical accounts, 87 native provider bindings and 87 audit events. Zero
missing/crossed bindings, four RLS-enabled private registry tables with no
anonymous/authenticated table grants, all six Realtime publications, 87 intact
Auth accounts, and unchanged original task/category/Diary/Settings/Bucket/link
counts were independently read back. All consents remain unset and
`personal_release_evidence` is NULL. **Do not install the final personal-writer
enforcement migration** before separate owner consent and restored after-state
evidence.

The **ten-table BEFORE R2 backup `20261028T053525682Z` is independently
restored and accepted**. The **new fourteen-table AFTER R2 backup is NOT YET
performed or restored**, so the identity registry is not yet protected by an
accepted offsite restore point. [Issue #1027](https://github.com/carlers/mosaic-life-tracker/issues/1027#issuecomment-6462867789)
holds the exact hosted evidence.

The protected-main fourteen-table manual workflow PR
[#1421](https://github.com/carlers/mosaic-life-tracker/pull/1421)
cannot merge under the existing `promotion-pr-preflight` rule (only
canonical-accepted `dev` source may promote to main). **Do not bypass/disable
branch protections or promote unrelated dev application bytes.** A separate
source-only, single-command **trusted Fedora operator alternative** is staged
as `supabase-poc/operator-fourteen-offsite.py` on the isolated recovery branch.

After exact-source focused and full CI acceptance, its one invocation:

1. Verifies pinned Git source, saved 0600 age identity / 0600 IPv4
   Scratch pooler, PostgreSQL 17 binaries, and probes/removes its own new
   disposable Docker bridge **before any source/R2 secret prompt**.
2. Privately requests one Scratch PostgreSQL password, backend-only
   `sb_secret_` Storage credential, and dedicated Cloudflare R2 WRITE and
   separate READ-ONLY credentials. It never logs, persists or passes these
   secrets as command-line arguments or to the browser.
3. Reuses the CI-accepted `unified-offsite.mjs --backup` to age-encrypt the
   **entire** hosted PostgreSQL/Auth database and whole private Storage media,
   enforce the **exact fourteen-table TOC**, publish the paired remote
   ciphertext with full per-part R2 readback and exactly one `COMPLETED`
   marker. Pruning is OFF.
4. Uses only the distinct R2 READ-ONLY key for the independent full-ciphertext
   `--watch` verification, requiring exactly the newly completed generation
   and `fourteen-personal-identity` profile.
5. Calls the **unchanged** previously proven `restore-unified-r2.py` recovery
   in process with the already-entered READ-ONLY credentials: full age
   authentication, isolated PG17 fourteen-table exact source/target row bytes,
   original-password signed local GoTrue owner and foreign-owner denial,
   entire private media and synthetic nonempty photo restore, and precise
   local stack, bridge and detached worktree cleanup.
6. Prints `MOSAIC_FOURTEEN_R2_COMPLETE_OFFSITE_DISPOSABLE_RESTORE_PASS: <exact-id>`
   only after every check succeeds. If R2 commit succeeds but any later
   stage fails, it retains the completed source and prints
   `MOSAIC_FOURTEEN_R2_ALREADY_COMMITTED_RETAIN: <exact-id>`; **do not
   rerun/re-upload** the accepted backup. Use the existing standalone exact
   restore for that identifier after fixing the cause.

This alternate path **does not modify main, dev, protected CI or the hosted
database** and cannot replace the named protected GitHub workflow long term.
It is a user-authorized local operation, not a rule exception. It still needs
a real operator pass and must not claim managed Supabase SMTP/OAuth/JWT
recovery, account-consent activation, signed hosted new-RPC acceptance,
Production cutover, or Preview reviewer approval.

**Default**: the assistant completes all safe connected GitHub, Supabase, Vercel
and CI steps without sending the operator to a terminal. If trusted machine
access, non-exportable credentials, or physical/device testing is necessary,
provide **one pasteable shell command per handoff**, at most **two**. That command
must preflight identity/source, do all authorized checks, clean up temporary
resources, and print only fixed sanitized PASS or failure markers. Do not
artificially split one workflow into an escalating series of manual requests.
Do not tell the operator to reuse stale or unknown credentials; make
secret prompts interactive and never include service keys/JWTs in a command,
repository, chat, Actions logs or a browser bundle.

**No action currently needed for the 2026-10-24 hosted photo cleanup.**
The original extra test photo was removed via the authenticated Storage API
(HTTP 200), with a later independent hosted inventory confirming **zero**
objects. The signed two-account photo RLS/immutable/private negative tests
and encrypted synthetic binary round-trip passed; the cleanup runner's old
final marker was misleading. The age-encrypted fresh PostgreSQL backup
independently restored **410 exact rows across seven tables**, and fresh
password sign-in/owner privacy checks passed. Don't ask the owner to repeat
these completed proofs or reconfigure the saved Fedora pooler.

## Tested one-command offline rehearsal

The reviewed source entrypoint is
[supabase-poc/operator-onepass.py](../supabase-poc/operator-onepass.py).
CI executes its no-secret/no-network real control path, using a synthetic
temporary home, local age identity and simulated child snapshot to prove
private-key environment isolation, a single guarded downstream call,
file permission checks, and denial of a publishable (non-admin) key.
It additionally tests that Git source is an **exact SHA** and belongs to
the pinned Scratch Storage identity. **This is an offline simulation, not
a test performed on the owner's Fedora or a live cloud backup.**

For an optional *local reproduction*, one pasted command:

```bash
set -o pipefail
repo="$HOME/mosaic-photo-dr-review/life-tracker"; \
git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && \
git -C "$repo" show FETCH_HEAD:life-tracker/supabase-poc/operator-onepass.py | python3 - --rehearse
```

Expected: `MOSAIC_ONEPASS_OFFLINE_REHEARSAL_PASS`,
`MOSAIC_ONEPASS_MAX_TWO_COMMANDS_PASS`, and
`MOSAIC_ONEPASS_NO_NETWORK_OR_CLOUD_WRITES_PASS`. It makes **zero**
remote requests or mutations after the Git source fetch and asks for no
passwords. The assistant already performs the same offline rehearsal in CI,
so do not require the user to rerun it merely to prove that it works.

## Complete historical recovery drill in one command

The one-pass simulation above is intentionally smaller than the Oct 24
sequence. The [full recovery drill](FULL_SUPABASE_RECOVERY_DRILL.md) now
orchestrates the **real** age-encrypted PostgreSQL dump, full-byte TOC,
fresh isolated seven-table restore, signed original-password owner isolation
and two-hosted-owner private WebP+age binary restore **in one invocation**,
with exact private stack and fixture cleanup. It reuses the already-saved
IPv4 Session pooler and age identity. It requires an interactive Fedora
session because the database and user passwords are private; those are
entered in the **same command**. A separate CI mock runs the full stage
graph, including a deliberately failed photo stage and clean teardown.

Do not confuse this existing-gates drill with managed Auth/SMTP backup,
scheduled complete Storage DR, or approved provider cutover. See that doc
for the exact single pasteable run command; no reason to repeat the original
individual commands.

## Future one-command full-bucket encrypted capture

This is *future work when a protected backend-only key is provisioned*,
not an instruction to run today. The runner intentionally does not
attempt to access a privileged key through management tools or silently
provision one. It prompts privately **once**, passes that credential only
to the existing bounded, read-only, project-pinned
`supabase-poc/private-photo-snapshot.py`, and reuses the existing
0600 age identity and 0700 encrypted-backup directory:

```bash
set -o pipefail
repo="$HOME/mosaic-photo-dr-review/life-tracker"; \
git -C "$repo" fetch --quiet origin feature/1027-supabase-recovery-20261020 && \
git -C "$repo" show FETCH_HEAD:life-tracker/supabase-poc/operator-onepass.py | \
python3 - --media-snapshot --source-sha "$(git -C "$repo" rev-parse FETCH_HEAD)"
```

It refuses a missing/invalid source SHA, wrong backend Storage source,
world-readable escrow, public-only API key, a failed decryption/checksum
or archive collision. It never calls remote SQL, Storage DELETE, Auth admin,
Vercel deploy or provider promotion. On success the underlying implementation
prints `SUPABASE_PRIVATE_MEDIA_ENCRYPTED_SNAPSHOT_PASS`, then the wrapper
prints `MOSAIC_ONEPASS_PRIVATE_MEDIA_SNAPSHOT_COMPLETE`. If the bucket
currently contains **zero objects**, the result certifies only an empty
inventory, NOT future media recoverability.

Still required before enabling hosted personal photos broadly:
protected recurring **full-bucket** backups/retention and alerts, an
independent *nonempty* media restore to a distinct authorized target,
managed Auth/configuration safeguards, mobile/offline/ZIP acceptance, and
the separately protected Preview approval. Neither the single synthetic
photo round-trip nor this one-pass snapshot source replaces those gates.

## Source-only old-PWA writer freeze plan (2026-10-26)

The offline `buildAppwriteFreezeDryRunPlan` function validates the exact original
owner ACL archive snapshot and independently supplied source witness, then
proposes whole-installation table, owner-row, Storage, file and enabled-Function
permission changes with original values retained in memory for review. It
makes **zero** backend/API calls. An unchanged already-read-only snapshot
produces no mutations but still refuses cutover. The real synthetic age lab
tests all grant classes, repeatability, no mutation of source and false
execution/rollback eligibility. Global grant changes affect other owners.

The proposal does **not** disable existing API keys/webhooks, authenticate a
server-side write fence, prove 21 old-PWA HTTP 403 responses or preserve queued
offline drafts. It must not be run against Scratch or Production as a mutation;
actual writer freeze/rollback requires separately approved guarded server code,
a complete live source snapshot and signed, authenticated negative probes.

## Old installed-PWA denial evidence and queued draft replay (source only, 2026-10-26)

`supabase-poc/appwriteOldPwaWriteDenialEvidence.ts` now verifies a detached
Ed25519 observer-signed 42-observation manifest: each of the six owner-personal
Appwrite tables and private photo Storage must show create/update/delete
rejection for both a still-authenticated installed old PWA and a queued-offline
draft replay. Distinct request nonces, exact source installation, independently
pinned historical PWA build hash, frozen owner/generation/lease, timestamp
window, HTTP 403 and all 21 externally pinned queued draft identifiers are
required. An **independent** observer key must differ from the server lease
signer, and the full denial manifest SHA must match the
`signedWriteDenialSha256` inside the separately Ed25519-authenticated frozen
seven-domain source lease. Tampered, missing, duplicate, foreign,
unauthenticated, HTTP 401/429/2xx and stale receipts fail closed.

This module only verifies an offline signed *claim*. It neither sends network
requests nor controls Appwrite row/Storage/Function permissions and cannot
independently establish that the claimed HTTP responses occurred. It does not
prove any owner drafts were safely preserved; real signed client negative
probes, separate operator-approved server writer cutoff/credential revocation
and exact encrypted offline outbox escrow remain mandatory. The verifier
explicitly keeps `actualBackendWriterFreezeConfirmed`,
`actualHttp403IndependentlyAuthenticated` and
`providerCutoverEligible` false. No actual PWA or Production backend changed.

## Next Fedora handoff: ONE consolidated pre-social acceptance run (owner directive 2026-10-25)

**Do not give the owner another Fedora command during routine personal-Supabase
development.** This overrides the prior habit of individual backup, local-RLS,
photo, Auth, settings, Bucket List, or migration drills: finish all achievable
connected/CI work first. The owner wants **one final pre-social trusted-machine
acceptance invocation**, rather than dozens of incremental manual steps.

Before requesting the next Fedora action, finish and accept in isolated source:
1. Personal non-social task/category/calendar/Diary/photo/Settings/Bucket List
   and task-link parity, portable owner IDs, private signed two-owner auth,
   offline/PWA/ZIP/TodoMate backfill and pending drafts.
2. Encrypted full database/Storage/attachments DR with updated table allowlists,
   independent R2 byte/auth verification and a complete disposable restore;
   the existing seven-table successful snapshot and native 30-day lock should
   be **reused as evidence**, not redundantly repeated. Cover any newly added
   data including settings and bucket links before enabling hosted writers.
3. Reviewed provider return/migration rehearsal for Appwrite Cloud, Appwrite
   Oracle (if actually available) and Supabase in both directions; independently
   verify mapping, writer fencing, tombstones, counts/hashes, attachments,
   unsynced/offline edits and reverse deltas. Stop safely when Appwrite quota,
   Oracle capacity or account ownership prevent acceptance.
4. Automated canonical GitHub Actions, trusted Preview and available connected
   checks, including repairing failures without privileged local handoffs.

**Build, then actually CI-test, one SHA-pinned, resumable operator runner** for
only the still-unverified private requirements. It should preflight exact Git
source/backend and approved inputs, reuse saved private age/R2 reader/pooler
configuration, prompt secrets invisibly once per distinct credential, and
execute the entire remaining pre-social stage graph in one terminal session:
full snapshot/verify/isolated restore, signed original-password owner isolation,
private personal rows and nonempty media, migration/return dry runs and cleanup.
Do not create unrelated backend writers or silently hard-delete/mutate live
data. Emit fixed `MOSAIC_PRESOCIAL_STAGE_BEGIN/PASS/FAIL` markers and one
final `MOSAIC_PRESOCIAL_ACCEPTANCE_PASS` only for genuinely verified gates;
no summary marker for simulated or skipped checks. Fail safely with
resume-capable private reports when a stage cannot be completed.

**ONE copy-paste command** is the default. A second is permitted only for a
documented, unavoidable trust/environment dependency, not as a staged testing
habit. No script should be presented until the fully implemented and reviewed
pre-social bundle is ready. In-person device acceptance and separate protected
Production promotion/cutover approvals still apply; the runner is never a
blanket authorization to change Production, release 1.0, access other users,
enable social, or bypass RLS/DR. Do not represent a dry-run as a real Production
migration. Keep issue #1027 and the operator's stated preference authoritative
across future chats.

## Agent handoff contract

1. Search/verify live repository branch + exact CI/hosted inventory first.
2. Execute any safe connector work fully and resolve routine failures.
3. If local action is truly unavoidable, batch it into **one** scoped,
   safely resumable command (two only when unavoidable) with hidden prompts,
   explicit success/failure boundaries and no repeat of already proven stages.
4. Wait for the user's result only where private local credentials or
   physical-device validation are inaccessible. Don't use ordinary
   operator workload as an excuse for unperformed connected-tool work.
5. Keep Preview reviewer approval, dev/main promotions, and Production
   writes separately gated by the repo's release policy. Even a one-command
   operator must *not* silently bypass approvals, RLS or disaster recovery.
