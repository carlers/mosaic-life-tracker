# Scratch-backed Preview readiness

This is the authoritative operational runbook for schema-compatible, isolated
Appwrite Previews. Read [backend workflow](APPWRITE_BACKEND_WORKFLOW.md) for
the Git-owned migrations/Function deployment boundary and
[delivery](DELIVERY.md) for branch CI and Vercel release checks.

## Definition: production-compatible, not data-replicated

A Preview must have the complete **currently released production-compatible
backend contract**, plus the approved feature's unshipped additive schema and
Function code. Git's managed manifest and ordered migrations are the source of
truth, **not** a live copy of production accounts, password hashes, personal
records, images, social graph, or message history. Production is always read-only
during Preview preparation. The scratch region, VAPID keys, function schedules,
browser hostnames, and test accounts intentionally differ.

The disposable scratch target is **My first project** in Frankfurt. Every
mutation requires its exact ID and explicit `--confirm-project`. Never use
production as an implicit CLI default, clone live users, or reset a non-empty
project to make a mismatch go away.

## Readiness command

Provide a scoped Appwrite API key from a secure local environment (never
commit, paste in logs, or prefix with `VITE_`). The read-only and mutating
commands require appropriate scopes for schema/Function inspection or writes.

```bash
export APPWRITE_API_KEY="<scratch-scoped-api-key>"

# Read-only: require exact matching managed schema, indexes, bucket,
# Function structure, Function variable contracts and active deployment.
npm run appwrite:preview:prepare -- \
  --project 6a96e82d000d1310b3be \
  --endpoint https://fra.cloud.appwrite.io/v1 \
  --expected-deployment <reviewed-scratch-deployment-id>

# One-time scratch reconciliation of *known additive* changes only.
npm run appwrite:preview:prepare -- \
  --project 6a96e82d000d1310b3be \
  --endpoint https://fra.cloud.appwrite.io/v1 \
  --confirm-project 6a96e82d000d1310b3be \
  --apply
```

`--apply` never touches production. It first compares the live scratch backend
against Git, allows only an explicit small list of known missing resources, then
runs the **existing ordered, idempotent** migrations 001, 002, 004, 005,
006, and 007 (server-owned task sharing), and checks the full managed state again. It does not apply migration 003
(the bucket-wide grant removal) implicitly because that is a permission
change; use the separately reviewed backend migration procedure for it.
Unexpected schema/permission/Function drift **fails closed**: inspect and
extend Git-owned migrations rather than auto-copying production. The
readiness command never silently deploys Functions or modifies auth policy.

For the shared-task workstream, verify the `task_shares` membership table and
all indexes first; a Function with shared-task event handlers must never be
activated against an environment lacking migration 007. Scratch currently
has no Git VCS linkage for `message-action`; deploy the source archive from
the exact reviewed Git SHA using the documented Function packaging workflow,
not a VCS-deployment API that requires a linked repository. Confirm the
registered Scratch origin and dispose of synthetic accounts after testing.

For new code, build the exact task SHA through
`npm run appwrite:function:deploy` (inactive), confirm READY, explicitly
activate the reviewed ID through `npm run appwrite:function:activate`,
then pass that ID to `--expected-deployment`. Keep scratch schedules disabled
unless a specific test explicitly needs one. Re-run readiness after *every*
backend change and after scratch resets/recovery drills. Backend smoke tests
and the registered hostname check are mandatory for authenticated handoff.

## Synthetic fixture accounts

Optional repeatable scratch identities for shared-task acceptance are:
`mosaic.preview.actor406@example.com`,
`mosaic.preview.friend406@example.com`, and
`mosaic.preview.other406@example.com`. The older two-account fixtures
used noncanonical profile/friendship row IDs and are deliberately **not**
modified by this seed; they must not be used for shared-task acceptance.
These synthetic identities are **not** a copy of production.
Use a separate password with 12+ characters, supplied out-of-band through
`MOSAIC_SCRATCH_TEST_PASSWORD`; a temporary project-scoped admin key with
users.write/rows.write scopes is required. Do not use personal passwords.

```bash
export MOSAIC_SCRATCH_TEST_PASSWORD="<strong-unique-scratch-password>"
npm run appwrite:preview:seed -- \
  --project 6a96e82d000d1310b3be \
  --endpoint https://fra.cloud.appwrite.io/v1 \
  --confirm-project 6a96e82d000d1310b3be
```

This seeds three accounts, each with a canonical profile ID, category,
uncompleted friend-visible task, and diary row containing `created_at`. The
actor is reciprocally accepted with each other account, with private
(read-only) friendship grants; the two friends are not linked. All rows use
the canonical IDs expected by the live server handlers. Both task and
category use Mosaic's supported
`followers` visibility (not `friends`), so an accepted friend can see the
seeded uncompleted task. Repeated runs preserve existing records/passwords;
they **never** clear or refresh existing data. To test notifications, subscribe
the viewer device to push and complete the actor's fixture task through the
app; a task that is already completed will not emit a new completion.

An operator may create a fresh scratch dataset with explicit destructive
approval after taking ownership of the Preview test environment; there is no
automatic reset, and restoration from production is NOT an alternative.

## Handoff acceptance checklist

1. Confirm exact Vercel Preview project ID/region and the stable branch alias
   are registered in scratch Appwrite Web platforms. Immutable Vercel URLs
   need their own registered origins; a healthy HTML page is not a CORS check.
2. Run `appwrite:preview:prepare` read-only after additive migrations and
   Function activation, with the approved active deployment ID. No managed
   drift is allowed. Confirm production auth-policy expectations on scratch
   (email-password and magic-url enabled; email-OTP, anonymous, invites, JWT,
   phone disabled); this is currently a **separate Console/project check**
   because the manifest checker owns backend resources, not auth settings.
   All seven method states matched on 2026-10-08 in a read-back after
   disabling the nonproduction methods on scratch.
3. Run a **real scratch login and import/Diary sync** using a disposable
   account. A green Function smoke test is not full browser acceptance.
4. Verify synthetic account ownership, required friend/completion flow, and
   scratch isolation. Do not test against production accounts or imported
   private records.
5. Pass focused CI → stable Preview canonical CI → READY Vercel, plus the
   requested phone/browser manual checks. Give the user the **stable alias**.

## Shared Preview backend coordination

One scratch project services all Preview branches and the `dev` Preview, so Appwrite schema and the active `message-action` Function are shared runtime state even when Git branches are isolated. Before changing them, inspect active Preview backend requirements and record the active scratch Function deployment/source SHA. Use additive/compatible rollout and fail closed on unexpected drift; batch compatible changes into the accepted branch before main. Revalidate existing critical Preview flows after an activation. No agent may silently replace another Preview's active Function, enable Scratch's cron, or reset scratch for a DR drill. Frontend-only work with unchanged backend code should simply reuse the verified scratch deployment after a read-only parity check where relevant.

## Shared project / disaster-recovery conflict

The same Free-plan scratch project is the DR restore slot. A DR exercise
requires an *empty* target, whereas an active Preview intentionally holds
test users and schema. Never delete/overwrite the current scratch project
during a Preview task, and do not run a DR restore into this nonempty project.
If a DR exercise must use the slot, coordinate an exclusive maintenance window,
obtain explicit approval for clearing the disposable data, record the active
Preview/function version and registered origins, then bootstrap/reconcile/seed
again afterward. There is no implemented cross-agent distributed lock:
agent documentation and explicit project confirmation are the current safety
boundary. A future remote lease is optional only if real concurrency becomes
a problem.

## Limits

- No production data/password cloning or ongoing production-to-scratch data
  replication.
- No implicit production writes.
- No automatic Function code activation or auth-policy updates.
- No claim of real browser login/push acceptance from schema or CI checks alone.
- A scratch API key is required for runnable CLI verification; if the connected
  environment has only Console access, agents must perform equivalent
  explicit-project read-only inspections and report the CLI limitation.

## Shared-task friendship permission drift

As of the 2026-10-10 read-only check, Scratch's existing `friendships` table has `create("users")` despite the Git manifest's `[]`. Do **not** hide this as an allowable drift or auto-apply a permission change. Use the separately reviewed, explicitly confirmed Git migration `008-friendship-permissions` once on the Scratch ID and endpoint; re-read `friendships` and verify old-client/server-controlled friendship behavior. Only then run the standard `--apply` additive preparation for `007-task-shares`. The Function must remain on its prior active deployment until table readiness and concurrent Preview requirements are verified.
