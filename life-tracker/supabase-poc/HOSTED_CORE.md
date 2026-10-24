# Isolated hosted core verification

This runbook applies only to `mosaic-dev` (`hcxtiifzxoaflhjgoglb`). It does
not migrate existing users, change Auth configuration, or deploy a frontend.
Use the environment's `SUPABASE_ACCESS_TOKEN`; never put credentials in a
command argument, repository file, issue, or build variable.

Run from `life-tracker/`, with Node 22 and installed app/browser dependencies:

```sh
node supabase-poc/hosted-core.mjs --inspect
node supabase-poc/hosted-core.mjs --probe
node supabase-poc/hosted-core.mjs --ui
node supabase-poc/hosted-core.mjs --conflicts
node supabase-poc/hosted-core.mjs --offline
```

In a managed environment where Node must use the configured HTTP proxy, set
`NODE_USE_ENV_PROXY=1`. The browser runner uses the inherited HTTPS proxy and
bypasses it only for its loopback static server. TLS verification remains enabled
for hosted Supabase. `MOSAIC_E2E_CHROMIUM_PATH` optionally selects an installed
Chromium; otherwise use the repository's installed Playwright browser.
Chromium must already trust the environment-provided proxy CA. Do not disable
certificate verification or silently change the user's persistent trust store.
If that trust change needs approval, finish the signed API probe and disposable
local-stack CI separately and leave hosted browser acceptance unresolved.
Chromium also needs access to initialize its NSS database: a read-only database
mount can prevent it from loading a CA that `certutil` already lists as trusted.
Use the environment's approved trust-store access; keep certificate verification
enabled.

Inspection is the default and makes no writes. It verifies the exact project
name/ref/health, migration history, row counts, Auth configuration access, and
security advisors. Output deliberately omits keys and sensitive Auth settings.
An Auth configuration 403 remains an unresolved policy-review gate even when
database operations work.

## One-time empty-project reconciliation

`--apply-empty-project` installs only the previously accepted protected-task
fields and fresh-account authority migrations. It is a one-time reconciliation
of the seven known hosted baseline migrations, not a general migration command.
The operation checks the migration history, zero Auth users, zero task/category
rows and absent authority tables **inside the same transaction**, with table
locks preventing concurrent signup/writes. Any mismatch aborts. Running it again
after installation fails closed; never reset the project to make it pass.

The transaction records exact source statements as versions `20261020130000`
and `20261020130001`, requests a PostgREST schema reload, and compares the stored
statements with the reviewed files. The command prints their SHA-256 hashes.
Earlier comments restricting these files to newly initialized infrastructure
remain applicable to arbitrary targets: only this explicitly checked empty
development baseline has the additional hosted reconciliation path.

## Signed security and actual application checks

`--probe` validates table RLS/grants, RPC grants/fixed search paths and private
schema access before provisioning two disposable, confirmed Auth accounts.
It uses actual password grants and `/auth/v1/user` verification; positive writes
and negative requests use signed user tokens, never the administrative key.
The administrative key is restricted to fixture Auth provisioning/retirement.

The suite checks both task/category ownership despite public visibility
metadata, foreign and anonymous denial, blocked direct update/physical delete,
concurrent CAS with exactly one winner, stale conflicts, protected fields,
server-generated revisions, missing/released/expired/revoked leases, frozen
authority and changed epochs. It checks that denied writes preserve stored data.
Expiry/freeze/epoch SQL is limited to UUIDs created by this invocation, with a
server-owned run marker checked inside each mutation transaction.

`--ui` additionally provisions two browser accounts, builds the real core-only
application with the development publishable key, and serves the build on an
ephemeral loopback port. It runs the existing app contract against hosted Auth
and PostgREST: sign-in, category/task creation, category rename/reorder/deletion,
Calendar/Day View editing, task edit/completion, Backlog move,
offline completion/deletion replay, second-device convergence, owner isolation
and absent Appwrite requests. The loopback server is for automated validation,
not a user-facing Preview. Management/admin credentials are removed from the
build and test subprocess environment. No service/admin key enters a Vite build.
Hosted assertions have a bounded 45-second default deadline for Auth and sync
round trips; the local lab retains its own shorter limits. Failure diagnostics
include bounded request method/path/status counts and network errors, never
request headers or bodies. Disposable passwords and access tokens are redacted
from assertion errors.

`--conflicts` runs the signed security checks and a separate disposable browser
contract: lose a real create response, edit offline while another signed session
changes the cloud row, review both versions, refresh a newer local draft, reject a
stale cloud choice, explicitly keep the device version and verify another device.
Identical response-lost replays may recover automatically; cloud divergence makes
this review scenario deterministic. `MOSAIC_CORE_REVIEW_SCREENSHOT_DIR` optionally
captures only the disposable comparison in Light, Dark and Black. It never captures
login fields or credential-bearing traces. These are browser screenshots, not
physical-device acceptance.

`--offline` exercises the installed service-worker shell and real browser
storage: reopen the previously verified owner offline, acknowledge a local task
edit, reload again, reconnect and verify another device. It also restores
simultaneous tabs sharing one refresh family, closes an authenticated tab without
logging out the others, and checks browser-wide logout/account isolation while an
independent device remains signed in. Service-worker installation requires a
normal subsequent navigation; the app still never forces activation or claim.
The same case runs against the disposable local stack in the core app lab.

Finally, the runner tombstones fixture rows through signed CAS, freezes their
authorities and bans their Auth accounts. It preserves revisions and tombstones;
there is no hard deletion. Retirement is attempted even when assertions fail,
and incomplete cleanup fails the command. A machine/process kill can interrupt
cleanup: recover only the exact run-marked disposable identities after inspection.
The command never resumes or cleans up arbitrary users.

Intentional advisor warnings for authenticated `SECURITY DEFINER` CAS/session
RPCs are reviewed against the signed negative tests; they are not silently
suppressed. New warnings/errors need investigation. This evidence does not replace
existing-user Appwrite fencing, reversible migration, encrypted restore,
manual-device or hosted Preview acceptance. The offline case proves only the
browser behavior actually exercised; it does not prove storage survives OS
eviction or installed mobile PWA lifecycle changes.
# Isolated Vercel core Preview

The #1027 Preview uses only `https://hcxtiifzxoaflhjgoglb.supabase.co` and the
`core-only` profile, at `https://mosaic-supabase-core-preview.vercel.app`.
This hostname is a planned destination until deployment evidence is recorded;
this document does not claim it is live.

`core-preview-public.json` contains the browser publishable key, never a service
role, management or deployment credential. `scripts/build-supabase-core-preview.mjs`
passes only public inputs and an allowlist of process infrastructure variables
to the build. No shared Vercel environment is pulled. The separate
`mosaic-supabase-core-<sha>-<run>-<attempt>` CI artifact is produced only after the
real local lab passes. Its profile records Supabase, core-only, exact origin and
public-key digest, with `appwriteBackend: none`; the ordinary trusted Appwrite
receiver continues to reject it.

An authorized operator must verify the stable source SHA's canonical acceptance
and successful Supabase lab/artifact job, download that exact run's artifact,
check the archive digest/inventory and recompute routing from the accepted
`vercel.json` using `assembleVerifiedStaticOutput`. Deploy only those static bytes
to Mosaic project `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`, team
`team_UbpudOr8jXyrDA5SdVUxVGOr`, with pinned CLI 62.7.0 and Preview target.
Use a distinct deterministic deployment ID incorporating the Supabase profile,
source SHA and artifact digest. Check existing deployment history before retries.
Do not change shared project variables, protection settings or ordinary aliases.
Assign only the isolated hostname after READY and exact metadata readback.

Before sending fixture credentials, read back that alias's project/deployment,
Preview target, source SHA and Supabase profile. Use `runHostedProbe` with
`exerciseHostedUi(client, accounts, origin, { origin: <isolated alias>, sha })`
to test the actual deployed bytes without rebuilding. The browser checks the
embedded source SHA, Preview channel and provider before login. HTTPS validation
stays enabled; fixture provisioning and retirement follow the existing runner.
Record the resulting disposable-account evidence separately from provider READY.
Email-confirmation signup/recovery and mobile/manual acceptance remain separate.

## Email confirmation and recovery

The isolated v0.32.3 candidate uses clean `/auth/confirm` and `/reset-password`
URLs. The email contains a **one-time code** in the message body; users enter
their email and code after Vercel protection/SSO. Vercel's login redirect has
been observed retaining synthetic fragments: **never email `token_hash` links**.
The GoTrue OTP is sent in a POST body, and the signed owner/email is verified
independently before confirmation or password update. These routes never mount
ordinary Auth or core writers. Already-issued legacy hash callbacks are
cleaned immediately and are not part of the new policy.

`NODE_USE_ENV_PROXY=1 node supabase-poc/hosted-email.mjs --ui` exercises real
mosaic-dev confirmation/recovery using server-marked disposable accounts and
generated OTPs. It checks active-account isolation, password login,
old-password and code-replay rejection, and fixture retirement/frozen owner
readback even after failure. It does **not** send mail. Ordinary local CI
skips these two hosted-only cases while covering the five core cases.

Read policy with `node supabase-poc/hosted-email.mjs --inspect-policy`.
The explicit `--configure-preview-email` mode is permitted only after
a **new verified accepted** exact-SHA Preview artifact and clean-template
preflight. It preserves unrelated redirects, SMTP and security settings,
requires confirmations, and verifies readback. The preview helper must reject
credential-bearing templates *before* any artifact download, provider
mutation, or alias reassignment. The Codex external operator helper is not
tracked in this repository; reconstruct/audit it independently. Keep the old
protected alias intact on any failure. Do not use previous `9391e990`
or `d3610222` artifacts or their unsafe templates.

Actual controlled-mailbox signup/recovery delivery and physical mobile remain
mandatory acceptance. Default hosted SMTP restrictions and the two-email/hour
limit are not resolved by generated links. No existing-user migration or
Production work is authorized by this runbook.

## Read-only CI artifact to Vercel prebuilt staging

`scripts/stage-supabase-core-artifact.mjs` accepts exactly four positional
arguments: downloaded GitHub Actions artifact ZIP path, **separately approved**
40-character source SHA, the GitHub-reported ZIP SHA256 digest, and a
**non-existing** output directory. Run it from a clean checkout of the accepted
`feature/1027-supabase-recovery-20261020` commit. It rejects mismatched
ZIP digest/member sets, branch/commit, provider profile, or CI archive checksum,
then delegates every tar-entry digest, symlink/path safety, build evidence and
routing reconstruction to `assembleVerifiedStaticOutput`. It writes exactly
those CI-built static bytes into `.vercel/output/static`, the pre-reviewed
routing v3 `.vercel/output/config.json`, and fixed Mosaic Preview
`.vercel/project.json`. It does **not** read credentials, rebuild, contact a
provider, deploy, assign an alias or approve a release. Its stage evidence is
explicitly `deploymentAuthorized: false`.

This is only a *prerequisite* for the external trusted operator: verify BOTH
canonical Quality Gate and Supabase Core App Lab at the same accepted SHA,
GitHub artifact ID/digest, immutable Preview target and exact project, code-only
email templates and old-alias/SSO state. Only then may the separate approved
operator use the staged directory for `vercel deploy --prebuilt`, verify its
actual READY metadata, safely update the isolated Auth email policy and alias,
exercise the deployed 3 core + 2 email disposable browser scenarios, and
revoke temporary credentials. Never use staging output as proof of deployed
acceptance or as permission to touch the existing Appwrite/Production paths.

## Fresh-account beta: zero-cost email destination (2026-10-21)

The accepted v0.32.4 artifact is currently on the **immutable, SSO-protected**
`https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app` Preview; its cold confirmation and reset paths were verified by the owner.
The older `https://mosaic-supabase-core-preview.vercel.app` alias is still on a different build.
The source-side Auth email policy now pins one-time-code navigation links to the
immutable deployment, not that old alias. This **does not** make the Preview
public: testers must first obtain approved Vercel share access; use a code in
the email body rather than credential-bearing callback URL parameters.

For **Brevo Free** use a verified Brevo transactional sender and the SMTP relay
`smtp-relay.brevo.com` (port 587 with STARTTLS, SMTP login and **SMTP key**, not
API key). Only enter credentials in the isolated `mosaic-dev` Supabase Auth
SMTP dashboard. Brevo's free-email sender replacement may be available but is
not guaranteed; inspect actual sender/recipient delivery and rate limits. Run
`node supabase-poc/hosted-email.mjs --inspect-policy` after configuration:
`brevoRelayConfigured` and `smtpSenderConfigured` are sanitized configuration
checks, **not** delivery proof. Follow with controlled real-mailbox confirmation,
reset, replay, and recipient/inbox tests; use sender/provider delivery logs.

Never invoke `--configure-preview-email` before independently verifying the
exact deployment, protected tester access, source policy diff and Auth target,
and obtaining an explicit authorization for the **isolated** Auth policy write.
Do not change shared Vercel aliases or Production/dev/main. The auth policy
patch preserves SMTP values and unrelated redirect entries; it does not
configure SMTP, suppress leaked-password warnings or approve public signup.

## Bound immutable-Preview browser exercise (2026-10-21)

The local, signed `--ui` and email `--ui` probes remain unchanged; they build
and test a localhost-served frontend. To exercise the **already vetted deployed
v0.32.4 bytes** instead, the operator uses the new `--ui-preview` mode in
`hosted-core.mjs` and `hosted-email.mjs`. Both commands are pinned to
`https://mosaic-life-tracker-6luuatyml-carls-projects-72516fde.vercel.app`
with exact build SHA `70d7485b06c0004769f03b0ad96189669777f05a`; no
arbitrary host, old protected alias, local rebuild or Production URL is accepted.

These commands **require** a short-lived, exact-origin
`MOSAIC_CORE_PREVIEW_SHARE_URL` bearing only the `_vercel_share` parameter.
Retrieve an approved temporary Vercel share link for this immutable deployment;
set the environment variable **privately on the operator machine**, never in
GitHub issues, source, CI logs or shell history. Also use the already held
`SUPABASE_ACCESS_TOKEN` in that same private environment. No credentials are
placed in the frontend. The runner validates both inputs **before creating
fixture identities**, exchanges the share URL separately within each fresh
Playwright browser context and navigates only to clean app paths. Browser
trace/screenshot/video are disabled, token-containing error text is omitted,
unauthorized access fails closed, and existing fixture retirement runs on
any post-provisioning failure.

From the `life-tracker/` directory after private environment setup:

```sh
node supabase-poc/hosted-core.mjs --ui-preview
node supabase-poc/hosted-email.mjs --ui-preview
```

Both are disposable/generated-code exercises; the latter **does not send email**
and cannot verify Brevo delivery. Real public signups, browser privacy/clean
incognito access, installed Android/iOS PWA and live user email delivery are
separate release gates. The `--ui-preview` mode never changes Auth policy,
Vercel alias/protection, published assets or real user content.

## Staged invite-only admission (2026-10-21; **not enabled**)

A protected Vercel URL is not an Auth-side registration gate: a publishable
Supabase key is public. Before allowing general beta access, enforce invitations
server-side. `migrations/20261021_beta_signup_invite_gate.sql` is a proposed,
**unapplied** extra migration, deliberately excluded from the one-time
zero-user hosted bootstrap. It creates a private exact-email allowlist with a
30-day maximum invite lifetime and explicit revocation, plus a fail-closed
GoTrue Before User Created Postgres function. Only `supabase_auth_admin` may
execute it. App clients, general authenticated users and even the Auth role
cannot read or write invitation rows. Use an operator-private database channel
to add invited addresses; never commit real emails or include them in CI logs.
No user metadata, domain wildcard or fixture/admin bypass is trusted.

`validation/20261021_beta_signup_invite_probe.sql` exercises the function in
an explicitly disposable database after installing the candidate migration,
with synthetic `example.invalid` addresses and unconditional ROLLBACK. It
covers invited, revoked, expired, uninvited, malformed and wrong-hook inputs.
These are **not yet runtime verified**. A real GoTrue negative/positive and
role/privilege acceptance is still mandatory; structural unit assertions are
not substitutes. The hook may run for Admin-created disposable fixtures, so
the current hosted lab **could fail** if enabled. Before any activation, use
safely provisioned short-lived fixture invites or isolate the candidate test
project; do not add a client-controllable bypass to get green tests.

Rollout requires separate explicit permissions for: (1) diff-reviewed isolated
schema installation and database role review, (2) private invite seeding and
enabling `pg-functions://postgres/mosaic_candidate_private/beta_before_user_created`
under Authentication → Hooks → Before User Created. Read back the exact
configuration and check successful invited and failed outsider signup before
providing any publicly accessible beta hostname. Record original hook state,
tested disable/rollback, sender and user rate limits. Nothing in this source
change installs or activates a hook or changes Vercel protection, old Appwrite
accounts, dev/main or Production.

### Disposable SQL verification in the signed core lab

The Supabase Core App Lab verifies the **staged but inactive** invitation
function in its isolated Supabase CLI PostgreSQL container, after existing
baseline migrations and before the signed UI tests. It uses local Docker
`psql -v ON_ERROR_STOP=1`, applies the candidate *only* in this disposable
database, then runs the transaction-rollback synthetic invitation probe.
The probe checks positive, rejected, revoked and expired invites, malformed
hook events, catalog-confirmed EXECUTE permission for `supabase_auth_admin`,
and the absence of invitation table access / client role execution grants.
The local migration owner cannot SET ROLE to the Auth administrator; actual
GoTrue role execution is **not** established by this SQL probe.

This is **not** GoTrue hook activation, live tester admission, hosted SQL,
real mail delivery, or proof that existing admin-created test fixtures still
work with the hook enabled. Test the actual local GoTrue dispatch, fixture
provisioning, and rollback before any separately approved hosted activation.

### Actual GoTrue hook acceptance (local CI only; never hosted)

After the existing signed browser core checks, the same disposable Supabase Core
App Lab destroys its first local CLI stack, enables Before User Created **only
in a fresh local config.toml**, adds the staged invitation migration to local
CLI migrations and resets the brand-new local database. It seeds synthetic
`example.org` invitations using only the local Docker PostgreSQL connection.
`supabase-poc/tests/beta-invite-gotrue-local.mjs` then sends ordinary
`/auth/v1/signup` requests over **localhost** to prove an invited address is
admitted while unlisted/revoked/expired requests are rejected, and checks an
explicitly invited admin-created disposable fixture. It finally counts the
resulting Auth identities. Signup confirmation is disabled in this ephemeral
stack; this test sends **no real Brevo or external email**.

This cannot directly authorize hosted `mosaic-dev` hook enablement. The
operational change requires explicit user approval, real inbox delivery and
tester access planning, a tightly scoped private invitation list, a new
management Auth config readback, controlled rollback, and a verified policy for
future hosted fixture users. Neither the existing immutable Preview nor any
Appwrite deployment is changed by the local lab.

## Owner-filtered Realtime wake (issue #1187; staged, not deployed)

Core-only beta uses RxDB signed incremental pull for authoritative state. The
optional `src/lib/supabaseRealtimeWake.ts` connects a single authenticated
Phoenix v1 channel to INSERT/UPDATE Postgres Changes for both candidate tables,
with `owner_id=eq.<signed Supabase owner UUID>` filters. It rejects unmatched
subscription acknowledgements and foreign-owner events, validates the current
signed session/epoch before any wake, debounces bursts and tears down on Auth
switch or view cleanup. No event payload is written to RxDB, no DELETE
subscription is used (Postgres Changes DELETE lacks RLS filtering), and normal
60-second/foreground/reconnect sync remains when websocket delivery fails.

`supabase-poc/migrations/20261021_core_realtime_publication.sql` requires
candidate tables to have verified owner-scoped SELECT RLS, no anonymous SELECT
or direct authenticated UPDATE grants, and an existing `supabase_realtime`
publication; it adds **only** the two candidate tables, idempotently. Do not
apply in Production/Appwrite or enable wildcard schemas/tables. In the
disposable lab, the schema and publication assertions run before the browser
test; network Realtime service may be excluded, so that job by itself does not
prove a working hosted websocket.

Before claiming low latency: run two real signed accounts against the deployed
Preview, confirm own updates wake remote device automatically without manual
sync, prove no foreign-owner notifications/rows, and exercise tab suspension,
JWT rotation, offline and websocket-denied fallback. Measure event rate and
simultaneous connection load against Supabase Free allowances. Publishing the
SQL is a separately verified hosted migration, not a license to open Vercel
protection or modify Auth SMTP settings. Roll back only by removing these two
tables from the `supabase_realtime` publication; never drop user data.

## Operator-only encrypted logical snapshot before core+Diary hosted rollout (#1027)

**Known metadata-pipeline SIGPIPE (exit 141):** The initial helper could discard a valid encrypted dump because `pg_restore --list` stops reading after the directory while `age` continues writing. The corrected helper validates the **entire** authenticated `age` stream first, then accepts producer SIGPIPE **only** if the separate metadata inspection succeeds. Do not interpret a past exit 141 or an empty backup directory as success; fetch the current isolated branch and rerun. A published .age file plus success output confirms only a readable encrypted archive, **not** an independently tested restore.



The Free `mosaic-dev` project has no automatic daily Supabase backup guarantee. Before **any** hosted Diary/category migrations, an operator must independently encrypt and preserve a recoverable off-site database snapshot. `hosted-encrypted-backup.sh` is source-read-only. It deliberately refuses other Supabase projects, repo-local output, and overwriting a snapshot. It streams the **raw** full PostgreSQL logical dump through `age` without writing plaintext to disk, then decrypts it privately into `pg_restore --list` to check archive structure. It does **not** restore data or grant rollout authorization.

### Fedora network and persistent connection setup — verified 2026-10-24

The operator's Fedora network **cannot route IPv6** to the direct PostgreSQL
host `db.hcxtiifzxoaflhjgoglb.supabase.co` (observed `Network is unreachable`).
**Future agents: do not recommend that direct host as the default, and do not
ask the operator to retrieve a new Session pooler host for every run.** On the
operator's Fedora machine, a working IPv4 Session pooler configuration has
**already been saved** in the local, private file:

```sh
$HOME/.config/mosaic/supabase-pooler.env
```

This local file is **not in Git, not synced to other machines, and contains
connection parameters only, no database password**. Reuse it from trusted
Fedora shells by running `source "$HOME/.config/mosaic/supabase-pooler.env"`.
It sets the actual project-issued `PGHOST=*.pooler.supabase.com`,
`PGPORT=5432`, `PGUSER=postgres.hcxtiifzxoaflhjgoglb`, and
`PGDATABASE=postgres`. Do not fabricate or replace its verified host with
one guessed from the region. If the file is absent **on another machine**,
obtain the correct host once from Supabase Dashboard → mosaic-dev →
**Connect → Session pooler**, then save locally with `chmod 600`.
Never commit it or put passwords, age keys, or complete database connection
strings in tickets or chat.

From the private Fedora recovery checkout, with existing key escrowed:

```sh
cd "$HOME/mosaic-photo-dr-review/life-tracker"
source "$HOME/.config/mosaic/supabase-pooler.env"
test -s "$HOME/.config/mosaic/supabase-backup.agekey" || {
  echo 'Existing age private key missing; stop'; exit 1;
}
export MOSAIC_AGE_IDENTITY_FILE="$HOME/.config/mosaic/supabase-backup.agekey"
export MOSAIC_AGE_RECIPIENT="$(age-keygen -y "$MOSAIC_AGE_IDENTITY_FILE")"
read -rsp 'mosaic-dev database password: ' PGPASSWORD; echo
export PGPASSWORD
archive="$HOME/mosaic-secure-backups/mosaic-dev-photos-$(date -u +%Y%m%dT%H%M%SZ).age"
if bash supabase-poc/hosted-encrypted-backup.sh "$archive"; then
  bash supabase-poc/inspect-encrypted-backup-toc.sh "$archive" "$MOSAIC_AGE_IDENTITY_FILE"
fi
unset PGPASSWORD
```

The user confirmed on **2026-10-24** that this saved Session pooler configuration
worked: `Encrypted snapshot created` plus successful **metadata-only**
inspection (731 TOC entries, 86 Mosaic-owned, 10 Mosaic-owned data, required
critical data entries 6/6, none missing). **No restore had yet been performed**
at that checkpoint. The ciphertext SHA was returned locally but is not a
substitute for the *separate* fresh-SHA-pinned isolated restore. Keep the
archive and encryption key on the user's machine.

PostgreSQL `pg_dump` must support the hosted server's major version; a failed
dump, permission denial, or failed age validation aborts publication.
**Never upload ciphertext, credentials or age private keys to GitHub,
ChatGPT, Preview or the repository.** Escrow the key offline.

**Still mandatory after this command:** restore the encrypted archive onto a separately isolated disposable Supabase-compatible target, prove per-owner row counts and hashes including tombstones and Auth identities, verify active RLS/grants/CAS/Diary privacy with signed negative tests, and separately preserve Auth email/hook/SMTP configuration plus any external Storage bytes and global-role requirements. An `age` decrypt + `pg_restore --list` pass alone is not a restore drill, nor is an ordinary personal Settings export. Keep signup invite gate, protected Preview and Production unchanged until all acceptance/rollback checks are green.

The original historical archive retains its fixed six-table record counts.
For a **fresh** current snapshot, the independently SHA-pinned
`--fresh-snapshot-sha256` recovery wrapper instead validates seven
allowlisted Auth/core/Diary tables and proves actual source-to-target COPY
row equality with a new empty loopback-only local PostgreSQL 17 Supabase stack
that mirrors only the already-hosted private Diary schema (not pending category retirement).
It does **not** replay old Auth tokens or write to hosted Supabase.
See `PRIVATE_CORE_RECOVERY.md` for its exact scope and prerequisites.
It is still only a partial database restore: managed Auth/SMTP configuration,
global roles, migrations and external Storage bytes need separate recovery
proof; any unexpected table/column mismatch fails closed.

**Photo-migration backup checkpoint (current zero Storage objects):**
(1) read back hosted project identity, photo bucket/object count **zero**,
current owner-domain and Auth counts and migration history;
(2) take a fresh age-encrypted logical snapshot with the source-read-only script
above and keep its key separately escrowed;
(3) remove *all* `PG*` and `DATABASE_URL` / `SUPABASE_ACCESS_TOKEN`
variables, then restore that exact archive into a new disposable local stack:

```sh
archive="$HOME/mosaic-secure-backups/LATEST-MOSAIC-DEV-SNAPSHOT.age"
identity="$HOME/.config/mosaic/supabase-backup.agekey"
sha="$(sha256sum "$archive" | cut -d ' ' -f1)"
bash supabase-poc/run-private-core-recovery.sh "$archive" "$identity" \
  --fresh-snapshot-sha256 "$sha"
unset sha
```

Treat only `DISPOSABLE_CORE_RESTORE_PASS: 7 data tables` as the reviewed
core+Diary row comparison. Preserve the printed disposable local target for
separate signed login/owner tests; no hostname or password gets sent to the
assistant. Never approve hosted photo migration on a TOC-only backup, on
the historical stale six-table snapshot, or if nonempty Storage objects
exist without independent encrypted media-binary escrow/restore.


## 2026-10-24 — approved isolated Scratch photo schema and signed-hosted acceptance

The operator's **fresh 2026-10-24 age-encrypted archive has been independently
restored**, with seven Auth/core/Diary tables and **410 exact source-versus-local-PG17
rows**. Original-password GoTrue sign-in, owner lease, populated-owner
task/category reads and foreign-owner read denial all passed on the **new**
disposable Fedora stack. Original sessions and old writer leases were not
replayed. This is **not** complete managed Auth/SMTP/Storage media disaster
recovery; keep the existing encrypted .age archive and local target private.

On the exact isolated mosaic-dev project `hcxtiifzxoaflhjgoglb`, a verified
read-only preflight confirmed 81 accounts, 63 task rows, 54 categories,
1 Diary, zero Storage objects/buckets and Storage RLS on. The reviewed,
source-controlled `20261023_candidate_private_personal_photos.sql` was then
applied via the connected Supabase migration API as **migration
`20261024061914_candidate_private_personal_photos_owner_rls_and_diary_cas_20261024`**.
Readback confirmed one private `mosaic-personal-photos` bucket, strict WebP
5 MiB limit, only three authenticated owner-UUID Storage
SELECT/INSERT/DELETE policies, no UPDATE/upsert policy,
anonymous Diary CAS EXECUTE revoked, and the photo-aware Diary CAS installed.
**All 81/63/54/1 core counts remained identical; Storage objects remained 0.**
This is an explicitly gated **Scratch schema-only** migration; no Production
data, `dev`/`main`, or protected Preview was promoted.

**Next gate — real hosted signed private Storage acceptance, not yet performed:**
Run the source-controlled `supabase-poc/verify-hosted-private-photo.py` on
the trusted Fedora host. This standard-library script is hard-pinned to the
mosaic-dev HTTPS API URL and refuses arbitrary arguments, endpoints or
redirects. It asks for the **publishable** project API key and credentials
for two **distinct existing Supabase test accounts** in local terminal
prompts (never send email, password, token, or key to the assistant).
With two separately signed GoTrue JWTs it uploads only one fresh random,
small WebP object into the first owner's prefix, proves binary readback,
rejects foreign/anonymous upload/read/delete and public URL/immutable overwrite,
and deletes the synthetic object before exit. The script has no admin credential,
never reads other owners' records or invokes Auth admin actions; it prints
only fixed `HOSTED_PRIVATE_PHOTO_*_PASS` markers. A failed test is a
hard-stop for Preview/production acceptance, not a reason to disable RLS.

```sh
cd "$HOME/mosaic-photo-dr-review/life-tracker"
# Pull latest isolated stable only if this worktree is on that branch;
# an existing SHA-pinned standalone worktree should use a new detached checkout
# or download the reviewed script from exact approved source instead.
python3 supabase-poc/verify-hosted-private-photo.py
```

**Before running, verify this script exists at your checked-out source SHA.**
If absent, use the Git-reviewed isolated stable branch containing it; do not
hand-create ad hoc Storage policies in the Supabase Dashboard. A publishable
key is available in Supabase Dashboard → mosaic-dev → Settings → API Keys.
Optionally set `MOSAIC_SUPABASE_PUBLISHABLE_KEY` privately in the local shell;
do not save account passwords. Two existing accounts are required; if only
one is available, stop safely rather than creating test Auth users with
unreviewed SQL. All signed tests are scoped to a fresh random object that is
removed on exit. Confirm Storage object count returns to **zero**.

The remaining rollout blocker **after the hosted signed checks** is an
independent encrypted Storage-**object-byte** backup and restore method
before real users create photos. PostgreSQL logical dumps alone do not
back up private Storage blobs. Media-aware user ZIP exports also require
device/manual acceptance and are not a backend-wide DR replacement. Only
after signing off that media recovery gate should the reviewer approve the
exact immutable protected Supabase v0.47.0 Preview job. Do not promote
Production or claim the private Bucket List/settings MVP is complete.

## CI-backed, opt-in Supabase prebuilt Preview deployment (#1250)

The same `Supabase Core App Lab` that produces the isolated, nondeployable
Supabase static artifact now offers a **protected Preview-only** delivery job.
The delivery job is **skipped by default**; it never deploys to `dev`, `main`,
Production, Appwrite, or any shared Vercel alias.

**One-time trusted operator configuration in GitHub Settings (never in the
repository):**

1. Create GitHub environment `mosaic-supabase-preview` with required reviewers,
   and restrict deployment branches to
   `feature/1027-supabase-recovery-20261020`.
2. In that environment, store a short-scope Preview Vercel access token as
   `MOSAIC_SUPABASE_PREVIEW_VERCEL_TOKEN` (secret), and set
   `MOSAIC_SUPABASE_PREVIEW_PROJECT_ID` (variable) to the reviewed
   `prj_jysOLDbuO9c5rP8x6Q145DVIw0fc`. Never store this token in
   `VITE_*`, output artifacts, issues, or PR bodies.
3. Only after verifying those protections, set the **repository** variable
   `MOSAIC_SUPABASE_PREVIEW_DEPLOY_ENABLED=true`. Removing it or setting it to
   false disables future automatic Preview deployment. GitHub environment
   approval remains in force for each run.

On an accepted push to the exact recovery branch, the existing Core App Lab runs
its signed disposable tests and produces the pinned Supabase static artifact.
The guarded deployment job then reads the latest original branch tip and
completed **exact-SHA** canonical Quality Gate, reads the artifact for its own
run/attempt, checks the GitHub-authenticated ZIP SHA-256 digest, runs
`stage-supabase-core-artifact.mjs` in a clean checkout, and only then uses
`vercel@62.7.0 deploy --prebuilt --archive=tgz --target=preview`.
It emits a new **immutable, protected Preview URL**, with source SHA/provider/
artifact fingerprint metadata. The separate Vercel READY readback must match
the hard-coded project, preview target, exact source and artifact digest.
A missing secret, variable, review, Quality Gate, artifact, branch match,
untrusted content or READY response fails closed.

The action does **not** change existing aliases, Vercel project settings,
Supabase Auth/email policy, data, or Production. In particular, the older
`mosaic-supabase-core-preview.vercel.app` alias remains on its existing build
until a separately approved and verified alias cutover. An immutable protected
URL requires tester SSO/share access. It is not evidence of signed-personal ZIP
or TodoMate import, two-device convergence, public signup readiness, user
migration, old Appwrite PWA fencing or production cutover.

**Operational note:** A new workflow commit produces a new CI artifact; older
downloaded artifacts are never renamed or reused by guessing an SHA. This
deployment job consumes only the artifact produced by its own accepted run.


### Protected Preview deploy retries and Vercel CLI auth

The approved Preview job must pass the protected environment `VERCEL_TOKEN` explicitly as `--token="$VERCEL_TOKEN"` on `vercel deploy --prebuilt`; environment presence alone is not Vercel CLI authentication. Keep GitHub masking enabled and do not echo the token. The job may be rerun after a transient Vercel failure. A GitHub job retry may retain the same-run original artifact rather than mint an artifact with the retry's attempt number: the verifier accepts only the latest available artifact whose name proves the exact branch SHA, same run ID, and attempt no greater than the current run attempt, with a separately verified published SHA-256 digest. Duplicate, malformed, future, expired or invalid newer artifacts fail closed. Each retry still requires the protected GitHub environment review as configured. Do not disable that requirement to hide deployment failures.


### Vercel prebuilt and monorepo root-directory compatibility (2026-10-23)

The reviewed Vercel project retains its Git root directory `life-tracker`. Its CLI
also validates that named directory when deploying a separately staged prebuilt
artifact from a temporary directory. The first approved `cd9e5bb3` deployment
failed *before upload* because the approved temporary staging root contained
`.vercel/output` but not an actual `life-tracker/` directory. This was not a
Supabase Auth, data, CI digest, or Vercel token failure.

The protected Preview job now checks that the verified `.vercel/output/config.json`
and `.vercel/project.json` exist, refuses an existing `life-tracker` path, then
creates **only an empty** `life-tracker/` directory within the temporary staging
root to satisfy the CLI's root-directory validation. The CLI still reads the
unaltered, already-authenticated `.vercel/output` at the staging root. No extra
application source or external files are bundled; no rebuild, remote project
settings update, alias operation or Production target is authorized. The exact
new task commit needs focused acceptance followed by a new isolated-branch
full canonical run, new artifact, protected reviewer approval and immutable
Vercel READY identity readback before any Preview URL is called verified.
