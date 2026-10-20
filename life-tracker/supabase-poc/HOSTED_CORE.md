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

Finally, the runner tombstones fixture rows through signed CAS, freezes their
authorities and bans their Auth accounts. It preserves revisions and tombstones;
there is no hard deletion. Retirement is attempted even when assertions fail,
and incomplete cleanup fails the command. A machine/process kill can interrupt
cleanup: recover only the exact run-marked disposable identities after inspection.
The command never resumes or cleans up arbitrary users.

Intentional advisor warnings for authenticated `SECURITY DEFINER` CAS/session
RPCs are reviewed against the signed negative tests; they are not silently
suppressed. New warnings/errors need investigation. This evidence does not replace
offline cold-start/refresh rotation, existing-user Appwrite fencing, reversible
migration, encrypted restore, manual-device or hosted Preview acceptance.
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
