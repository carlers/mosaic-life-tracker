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
