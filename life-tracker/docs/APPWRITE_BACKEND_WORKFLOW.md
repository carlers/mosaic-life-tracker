# Appwrite backend workflow

Git is the source of truth for Mosaic's Appwrite backend. Appwrite Cloud is the runtime,
not the place where backend changes are authored. Normal frontend work must not wait on or
mutate Appwrite.

## Source of truth

| Concern | Repository source |
|---|---|
| Fresh database/table/bucket shape | `infrastructure/mosaic-backend.mjs` |
| Portable Function definition and variables contract | `appwrite-functions/*/function.config.json` |
| Production Appwrite CLI target/overlay | `appwrite.config.json` |
| Existing-project schema evolution | ordered migrations exposed by `scripts/appwrite-migrate.mjs` |
| Function source | `appwrite-functions/<name>/` |
| DR/fresh-project provisioning | `scripts/bootstrap-mosaic.mjs` and DR runbooks |

`appwrite.config.json` intentionally contains the production project target. Do not treat its
project ID as permission to mutate production. Mosaic mutation scripts require an explicit
`--project` target plus the same value again as `--confirm-project`.

The portable Function configs and `appwrite.config.json` duplicate a small set of Function
fields because Appwrite CLI requires its own project file. `npm run appwrite:status` checks
that the duplicated structural fields still agree. Schedules, secrets/variables, VCS linkage,
and environment-specific Function IDs are operational state and are not drift-enforced.

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

Use `--without-dr` for a backend intentionally provisioned without the DR Function. Drift
returns a non-zero status. The checker covers Mosaic-managed database/table/column/index,
bucket, and structural Function configuration. It reports active/latest Function deployment,
schedule, live state, and VCS linkage without enforcing environment-specific operational
values.

## Schema migrations

Existing installations evolve through one ordered reconciliation command:

```bash
APPWRITE_ENDPOINT=<url> \
APPWRITE_PROJECT_ID=<project-id> \
APPWRITE_API_KEY=<write-key> \
npm run appwrite:migrate -- \
  --project <project-id> \
  --confirm-project <project-id>
```

Current ordered migrations are:

- `001-account-deletion`
- `002-diary-created-at`

Use `--only <migration-id>` only for targeted recovery or compatibility work. The runner is
intentionally ledger-free for now: every migration is idempotent and reconciles already
applied state safely. Add a new numbered migration for new schema work rather than creating
another one-off setup command. Do not repurpose an existing migration ID.

Prefer additive/expand-first migrations. A destructive rename/drop requires scratch-project
proof, a recovery/backup plan, compatibility across the deployment window, and explicit
production approval. Production database rollback normally means a forward-fix migration,
not an automatic destructive `down` migration.

## Function deployment and activation

A Function edit does **not** require a new Function resource. Appwrite keeps multiple code
deployments under the same Function.

Build an inactive deployment from the exact checked-out commit:

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

The deploy command fails if the selected Function directory has uncommitted changes, if the
provided SHA is not `HEAD`, or if the live Function's structural configuration drifts from
Git. It creates the Appwrite deployment with activation disabled, waits for `ready`, and
prints the Git SHA ↔ Appwrite deployment ID mapping. Traffic is unchanged.

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
6. For a Function rollout, build an inactive exact-SHA deployment, inspect the deployment ID
   and build result, then activate explicitly.
7. For production schema changes, run the reviewed migration explicitly against the confirmed
   production project, then rerun `appwrite:status`.
8. Record the deployment/migration result in the task handoff. Emergency Console changes must
   be reconciled back into Git before the task is considered complete.

Do not enable native Appwrite Git auto-deploy for production by default. Mosaic's Git branch,
Preview, database migration, and Function activation boundaries need one deliberate rollout
order; a second automatic deployment pipeline would make that order harder to reason about.

Future external integrations belong as isolated routes/modules in the existing trusted
`message-action`/future `app-api` Function unless the architecture is deliberately changed.
Provider secrets and OAuth tokens stay server-side. Use provider sandboxes/mocks first and
the scratch project when real callback/webhook infrastructure is required.
