# Appwrite backend workflow

Git is the source of truth for Mosaic's Appwrite backend. Appwrite Cloud is the runtime,
not the place where backend changes are authored. Normal frontend work must not wait on or
mutate Appwrite.

## Source of truth

| Concern | Repository source |
|---|---|
| Fresh database/table/bucket shape | `infrastructure/mosaic-backend.mjs` |
| Portable Function definition and variable contract | `appwrite-functions/*/function.config.json` |
| Production Appwrite CLI target/overlay | `appwrite.config.json` |
| Existing-project schema evolution | ordered migrations exposed by `scripts/appwrite-migrate.mjs` |
| Function source | `appwrite-functions/<name>/` |
| DR/fresh-project provisioning | `scripts/bootstrap-mosaic.mjs` and DR runbooks |

`appwrite.config.json` intentionally contains the production project target. Do not treat its
project ID as permission to mutate production. Mosaic mutation scripts require an explicit
`--project` target plus the same value again as `--confirm-project`.

The Function configs and `appwrite.config.json` duplicate the structural fields Appwrite CLI
needs. `npm run appwrite:status` verifies those local copies agree. Remote schedules, VCS
linkage, and environment-specific Function IDs remain operational state because scratch/DR
environments intentionally differ. Declared Function variables are managed more strictly:
exact non-secret values are checked where portable, required non-secret/secret keys must exist
with the correct secrecy classification, optional declared variables may be absent, and
undeclared Function variables are drift. Secret values themselves are never read.

Three empty pre-foundation production placeholders—`routines`, `stickers`, and
`analytics_events`—are explicitly recorded as tolerated legacy table IDs. They are not part
of fresh backends or active runtime ownership. Any other unmanaged table is drift.

## Environment policy

Mosaic does not reserve a permanent second Appwrite Cloud staging project. The Free-plan
project slot named **My first project** is the disposable scratch/DR project. Keep it paused
when unused. It may be bootstrapped, restored, tested, and discarded for risky backend work,
but no normal workflow may target it or production implicitly.

Use the cheapest isolation that proves the change:

1. Pure Function logic: handler/unit tests first.
2. Function runtime behavior that does not need real cloud state: local Appwrite/Docker is
   acceptable.
3. Cross-service behavior, OAuth/webhooks, risky schema work, restore drills, or destructive
   experiments: use the scratch project with synthetic/disposable data.
4. Production: only after repository verification and explicit rollout approval.

A disposable **account** isolates user data but does not isolate project-wide schema,
Functions, buckets, schedules, or provider configuration. Use the scratch **project** when
those resources are under test.

## Vercel Preview backend isolation (2026-10-08)

All official **Vercel Preview** deployments, including stable `feature/*`,
`fix/*`, `perf/*` and `dev`, use the disposable **My first project**
Appwrite backend (`6a96e82d000d1310b3be`, `https://fra.cloud.appwrite.io/v1`).
Only the production Vercel environment may use production Appwrite. A
development branch is not an authorization to use production accounts/data.

The three Preview-only Vercel variables are:
`VITE_APPWRITE_PROJECT_ID`, `VITE_APPWRITE_ENDPOINT`, and
`VITE_APPWRITE_MESSAGE_ACTION_FUNCTION_ID`. No Function API key, VAPID
private key, or credentials belong in browser-facing `VITE_*` values.
`vite.config.ts` calls `scripts/lib/preview-backend-isolation.ts` to fail
the production build unless the Preview project ID and region endpoint match
the configured scratch target. This check is build-time, and direct links
to a prior deployment still contain the endpoint compiled at the time.

The scratch project must explicitly register the stable Vercel Preview
hostname under Appwrite Web platforms (no wildcard production host grant).
Vercel's unique immutable deployment hostname changes on every build;
Appwrite does **not** register it just because a branch alias is allowed.
Use the stable branch alias from Vercel's deployment alias list for
authenticated Preview links. If an immutable deployment hostname is needed,
register that precise hostname separately on scratch. Before asserting login
works, compare the Vercel Preview URL hostname with the live Appwrite
project's Web-platform allowlist. An unregistered origin commonly surfaces
as a generic browser "Failed to fetch" instead of an Appwrite login error.
A web server returning HTTP 200 for `/login` only tests Vercel delivery;
it does not validate cross-origin `/v1/account/sessions/email` requests.
A final browser login still needs real-user/device acceptance; a read-only
platform-list check cannot prove all network requests succeed.
Keep synthetic/disposable data only, and revalidate the scratch project
after DR restores/disposal. Preview creation does not automatically
bootstrap a reset scratch project or migrate/deploy new Function code; tasks
that modify Appwrite must perform the explicitly confirmed scratch migration
and exact-SHA inactive Function deployment, activate it and verify live
behavior before requesting dev/main promotion.

For a different scratch project, update the Git-owned isolation guard and
Vercel Preview vars together in a reviewed task, with matching project Web
platforms; never silently fall back to production. Deployment environment
changes only affect **newly built** Previews; redeploy/rebuild to apply them.

## Scratch parity and Preview readiness gate

The operational runbook is [Scratch Preview Workflow](SCRATCH_PREVIEW_WORKFLOW.md).
`npm run appwrite:preview:prepare` is a scratch-ID/region-pinned,
read-only-by-default managed-state gate. Its explicitly confirmed `--apply`
option reconciles only reviewed additive migration gaps before checking
managed schema, indexes, Function structure, variables and active deployment.
It never clones production accounts or activates Function code on its own.
Synthetic fixture seeding uses a separate guarded command,
`npm run appwrite:preview:seed`. This gate is required before handing off
backend-dependent Previews, not before ordinary frontend-only builds.
Actual scratch CORS origins, auth-method configuration, login and Diary
replication remain additional live acceptance requirements.

## Read-only drift/status check

```bash
APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1 \
APPWRITE_PROJECT_ID=<project-id> \
APPWRITE_API_KEY=<read-key> \
npm run appwrite:status
```

Optional target overrides:

```bash
npm run appwrite:status -- \
  --endpoint <url> \
  --project <project-id> \
  --message-function-id <id> \
  --dr-function-id <id>
```

Use `--without-dr` when the target was intentionally bootstrapped without DR; this also
expects the message Function's DR privacy guard to be false. Use `--recovery-drill` for the
isolated restore topology that intentionally deploys a credential-less `dr-backup` Function
and keeps that privacy guard false. Those two flags cannot be combined. Drift returns a
non-zero status.

The checker verifies the managed database, exact declared table column/index sets, bucket,
Function structure, live-deployment presence, and declared Function-variable contract.
Permission/scope/extension collections are compared as sets so harmless API ordering cannot
create false drift. It reports active/latest Function deployment, schedule, live state, VCS
linkage, and tolerated legacy tables.

The manifest intentionally describes the fields Mosaic owns, not every database-engine
default. For example, an omitted integer min/max is not inferred by the checker. If such an
engine constraint becomes a product/backend requirement, add it to the manifest and migrate
it deliberately rather than teaching the checker a production-only special case.

## Schema migrations

Existing installations at the backend-version-control baseline evolve through one ordered
reconciliation command:

```bash
APPWRITE_ENDPOINT=<url> \
APPWRITE_PROJECT_ID=<project-id> \
APPWRITE_API_KEY=<write-key> \
npm run appwrite:migrate -- \
  --project <project-id> \
  --confirm-project <project-id>
```

Current ordered baseline reconciliations are:

- `001-account-deletion`
- `002-diary-created-at`
- `003-task-images-bucket-permissions` — removes the known pre-foundation
  bucket-wide `read("users")` grant while preserving per-file permissions. Appwrite grants
  access when either bucket or file permission allows it, so bucket-wide read would otherwise
  bypass Mosaic's file-security boundary. The migration sends the full intended bucket
  configuration and fails closed on any bucket drift other than that one known legacy grant.
- `004-notifications` — creates the server-only `notifications` and
  `push_subscriptions` tables from the portable backend manifest. Existing tables are
  accepted only when their managed columns, indexes, permissions, row-security flag, and
  enabled state match the manifest; incompatible pre-existing resources fail closed.
- `005-notification-retention` — adds the `notifications.created_at` retention
  index on existing backends. New installations already have the index in
  the manifest. Apply before activating hourly Alerts cleanup.
- `006-push-details` — adds the optional default-false
  `push_subscriptions.include_task_details` boolean. Apply on the explicit
  target before activating the Function that writes rich per-device push
  preferences; do not retrofit legacy subscriptions to opt in.
- `007-task-shares` — adds the server-only membership table and owner/invitee/task
  indexes from the portable manifest. Apply only on the explicitly confirmed
  scratch backend before activating the new `message-action` code; the task
  notification event handler now consults this table. Do not activate a Function
  requiring `task_shares` before the schema is READY. The sharing Function
  transaction removes legacy client direct-update permissions on newly shared
  owner rows while retaining owner read/delete permissions; new owner edits use
  `compare_and_set_owner_row`. This intentionally fences pre-upgrade browsers
  from silently overwriting a collaborator's completion. Scratch old-client
  compatibility tests remain required before user-facing rollout.

The runner is not a replay of every historical pre-foundation Console/script change. Fresh
forks bootstrap the current manifest, and production was already at the current historical
baseline when this workflow was introduced. Old production-ID-hardcoded setup/add-column
scripts were therefore retired from the active tree; Git history preserves them for forensic
reference, but future agents must not resurrect or run them.

Use `--only <migration-id>` only for targeted recovery or compatibility work. The runner is
intentionally ledger-free for now: every migration is idempotent and reconciles already
applied state safely. Add the next numbered migration for new schema work; never create a new
production-targeted one-off script and never repurpose an existing migration ID.

The `task_images` bucket intentionally grants authenticated users create permission at the
bucket level but no bucket-wide read permission. Task/profile files that are meant to be
friend-readable carry `read("users")` on the individual file; owner-only files remain
owner-only. Do not "fix" drift by adding bucket-wide read back to the manifest.

Prefer additive/expand-first migrations. A destructive rename/drop requires scratch-project
proof, a recovery/backup plan, compatibility across the deployment window, and explicit
production approval. Production database rollback normally means a forward-fix migration,
not an automatic destructive `down` migration.

## Function deployment and activation

A Function edit does **not** require a new Function resource. Appwrite keeps multiple code
deployments under the same Function.

First run `appwrite:status` against the intended target. If the checked-in Function
configuration changed (for example event triggers), reconcile that configuration explicitly
before building code:

```bash
npm run appwrite:function:configure -- \
  --function message-action \
  --project <project-id> \
  --confirm-project <project-id>
```

Configuration reconciliation preserves the target's live schedule so scratch/DR can keep
schedules intentionally disabled. It does not activate code. Then build an inactive deployment
from the exact checked-out commit:

```bash
APPWRITE_ENDPOINT=<url> \
APPWRITE_PROJECT_ID=<project-id> \
APPWRITE_API_KEY=<functions-write-key> \
npm run appwrite:function:deploy -- \
  --function message-action \
  --git-sha "$(git rev-parse HEAD)" \
  --project <project-id> \
  --confirm-project <project-id>
```

When a scratch Function ID differs from the production/default config ID, also pass
`--function-id <id>`.

The deploy command fails if the selected Function directory has uncommitted changes, if the
provided SHA is not `HEAD`, or if the live Function's structural configuration drifts from
Git. Variable drift belongs to the preceding status gate because scratch environments can
legitimately override environment-specific values. Deployment creates inactive code, waits
for `ready`, and prints the Git SHA ↔ Appwrite deployment ID mapping. Traffic is unchanged.

Activate only the deployment that was reviewed:

```bash
npm run appwrite:function:activate -- \
  --function message-action \
  --deployment <deployment-id> \
  --project <project-id> \
  --confirm-project <project-id>
```

Activation accepts only a `ready`/already-active deployment and verifies Appwrite's active
deployment ID afterward. Re-activating a retained older deployment is the Function rollback
mechanism. `message-action` currently keeps non-active deployments indefinitely; DR retention
is governed by its Function config.

## Normal agent flow

For ordinary UI/client/refactor work, do nothing Appwrite-specific. For backend changes:

1. Branch and edit the repository; never experiment by editing production in Console.
2. Add/update tests. If schema changes, update `mosaic-backend.mjs` and add the next ordered,
   idempotent migration.
3. Run normal focused/canonical repository verification.
4. Run `appwrite:status` against the intended target.
5. If cloud integration proof is needed, use **My first project** as the explicit scratch
   target and synthetic/disposable accounts/data.
6. For a Function rollout whose structural config changed, run the confirmed-target
   `appwrite:function:configure` step first. Then build an inactive exact-SHA deployment,
   inspect the deployment ID and build result, and activate explicitly.
7. For production schema changes, run the reviewed migration explicitly against the confirmed
   production project, then rerun `appwrite:status`.
8. Record the configuration/deployment/migration result in the task handoff. Emergency Console changes must
   be reconciled back into Git before the task is considered complete.

Do not enable native Appwrite Git auto-deploy for production by default. Mosaic's Git branch,
Preview, database migration, and Function activation boundaries need one deliberate rollout
order; a second automatic deployment pipeline would make that order harder to reason about.

Future external integrations belong as isolated routes/modules in the existing trusted
`message-action`/future `app-api` Function unless the architecture is deliberately changed.
Provider secrets and OAuth tokens stay server-side. Use provider sandboxes/mocks first and
the scratch project when real callback/webhook infrastructure is required.

- `008-friendship-permissions` — **manual explicit-only security repair**, not part of automatic Scratch Preview preparation. The read-only Scratch check on 2026-10-10 found the legacy `create("users")` permission on `friendships`; the Git manifest requires `[]` because reciprocal friendship status is Function-owned. This narrow idempotent migration checks the existing table shape and indexes first, refuses unknown grants, removes only the known broad create permission, and confirms read-back. Execute with `appwrite:migrate -- --only 008-friendship-permissions --project 6a96e82d000d1310b3be --confirm-project 6a96e82d000d1310b3be` **with explicit Scratch endpoint and appropriately scoped Scratch API key in environment**. This is not authorized against Production by a Scratch acceptance. Legacy clients that created friendship rows directly can no longer do so; verify server-managed friendship flows and stale-client failure safety. After repair, `appwrite:preview:prepare --apply` may proceed with the additive migration 007.

Migration 008 is programmatically excluded from **both** default CLI `selectMigrations()` and default `runAppwriteMigrations()`; only `--only 008-friendship-permissions` opts into it after the explicit project and confirm checks. Do not rely on a prose warning alone for this boundary.


## Concurrent Preview / Scratch single-writer lane (#526)

Frontend and local/CI testing can run on independent branches. Scratch is **one**
project-wide runtime, so all active Previews share its Function code, tables,
permissions, indexes and variables. A disposable user account isolates rows, not
the backend contract.

The **combined backend candidate** must include every in-flight Scratch
consumer's server contracts before activation. In particular, Backlog #407's
unscheduled-task privacy checks must coexist with shared-task #406's membership
and permission handlers. A feature branch's Function archive is **not** safe to
activate merely because its own focused checks passed.

The repository's `.github/workflows/scratch-backend-activation.yml` is a
manual, single-concurrency-group writer. After explicit approval and promotion
of that workflow to `main`, supply an exact reviewed source SHA, the currently
active Scratch deployment ID, and typed confirmation. It checks the live
managed-state contract, runs unit/handler tests against the combined candidate,
builds an **inactive** exact-SHA deployment, verifies the active ID did not
change, activates it, and runs strict readiness against the new ID. It requires
the `MOSAIC_SCRATCH_APPWRITE_API_KEY` Actions secret with narrowly scoped
permissions; no secret is committed and missing credentials abort safely.

Direct Scratch Function activation/configuration via
`scripts/appwrite-function.mjs` now also requires
`--expected-current-deployment <observed-id>` (or `none` for a verified
empty slot). This detects stale agents, but **cannot atomically exclude**
external Console/API writes between check and update. GitHub Actions
`concurrency` also cannot lock direct CLI/Console writers: restrict API-key
distribution and refrain from out-of-band Scratch mutations while an
integration run is active. Schema migrations and config edits require the
same coordinated lane and separate reviewed migration procedure; this
activation workflow does not auto-apply migrations.

After any Function activation, previously accepted backend-dependent Previews
must revalidate their required server contract and authenticated scenarios.
Static CI/Vercel READY alone is insufficient. Retain the previous deployment
ID for a code rollback only if the current schema remains compatible.

### Exact source and secret-scope safeguards (audit follow-up)

The activation workflow accepts only the **current exact SHA** of the explicit
`refactor/scratch-backend-integration-526` allowlisted branch, **and** an
exact-SHA successful full canonical `Quality Gate` push run on that same branch.
This prevents arbitrary historic/foreign commits from being selected as
Function source. To change the integration branch, update the workflow's
allowlist through a reviewed default-branch change; do not weaken the proof to
a branch-name prefix or an unchecked SHA. GitHub Actions `actions: read`
permissions are needed for its CI evidence query.

The Scratch API key is exposed only to the read-only readiness, inactive build,
activation and final readiness steps, **not** to `npm ci`, candidate tests or
source selection; Checkout does not persist GitHub credentials in its working
tree. Configure the GitHub `scratch-backend` Environment with **required human
reviewers**, restricted to `main`, and an appropriately scoped Scratch-only key
before enabling the default-branch workflow. Without these settings, a typed
confirmation and passing CI are **not** proof of authorization to deploy.

This Function-only workflow does **not** serialize direct CLI, Console or schema
migration writes. Grant mutating Scratch credentials only to its designated
maintainer, coordinate schema migrations using the same writer window, and
revalidate old clients before and after any schema change. Full enforcement of
all Scratch schema writes remains an open part of #526, not a shipped guarantee.
