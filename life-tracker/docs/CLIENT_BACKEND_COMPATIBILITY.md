# Client and backend compatibility — Phase A (#914)

Mosaic clients, offline PWAs and backend deployments do not update atomically.
Schema is additive by default: expand, verify supported clients, migrate, then
contract only after a separately approved retirement window. Do not silently
assume that a waiting service worker has replaced the running old JavaScript.

## What runs automatically

The `checks` job of the canonical Quality Gate runs
`node scripts/check-backend-consumer-compat.mjs --base HEAD^` after installing
dependencies. It invokes the existing historical
`scripts/check-scratch-client-compat.mjs` read/write mapper and strict local
schema checker **only** when a commit changes managed backend schema, migration
source, Function code/config, synchronized schema/mappings/subscription source,
or the compatibility policy/checker itself. Ordinary frontend-only and prose
changes do not gain another cloud or long-running test.

`config/backend-client-compatibility.json` holds pinned full Git SHAs for
the explicitly *supported* client snapshots. Subscriptions are loaded from
each consumer's immutable `src/db/replicationIds.ts` rather than guessed
from the current manifest. New tables an old client never subscribed to are
not silently scored as a failure or counted as tested. An unfamiliar
subscription, incomplete policy, missing source or failed row/write check
fails closed. A shallow Git checkout fetches only the missing explicitly
pinned commit. Run the complete check locally with:

```bash
node scripts/check-backend-consumer-compat.mjs --all
```

The old scoped diagnostic also remains available:

```bash
npm run appwrite:preview:compat -- \
  --consumer-sha <full-historical-sha> \
  --table tasks --table categories --table diary \
  --table settings --table friendships --table messages
```

Avoid manually selecting a subset of collections for the automatic gate.
The human-reviewed support matrix is explicit in the policy file; a version
not listed there is **not certified** by this checker. When public users
exist, keep every still-supported shipped source SHA in the matrix and
remove it only after separately recorded installed-client retirement or
the reviewed end of its support window. Changing that matrix is a reviewed
backend contract decision, not a mechanism to make failing CI turn green.

## Current pre-public policy (2026-10-16)

The pinned v0.29.1 dev SHA is the integration baseline for future backend
changes. v0.17.4 main is separately documented as **legacy pending retirement**
because the only known installed copy is controlled by the owner and the app
has not been publicly released. The old version's strict RxDB mapper really
fails on newer optional Diary/message fields. It is *not certified*, and its
presence in `legacyPendingRetirement` is **not evidence that the owner has
updated it**. Before Production migrations 012, 013 and 015, #889 still
requires confirmation that the owner's PWA is synced and updated/retired,
or else a separate backward-compatibility strategy.

At first public release, review the actual supported release SHAs, subscriptions
and guarantees with issue #914; the current pre-public matrix is not an
automatic public-client retention policy.

## What the preflight proves — and does not prove

It checks remote-to-local serialization, strict RxDB field acceptance,
outbound payload fields/types and owner IDs against the **candidate Git
manifest**, including an unknown future field. It catches accidental
forward-field leakage into an older local schema. An older client that emits
unknown remote fields back to the server fails.

The preflight is **source-only**: it is not proof of actual Appwrite partial
update merging, Function action/permissions, existing-row preservation,
row-level access, network error handling, service-worker activation or
offline queued-write convergence. Review these independently whenever
migrations/functions affect them. Do not say a green check licenses a
Production rollout. Preserve the old READY Function, use isolated synthetic
data, test real old/new client roundtrips when risk justifies it, then
record human/mobile/PWA acceptance separately.

## Deferred work

#914 Phase B: isolated live Appwrite old/new client and Function rehearsal
including delayed PWA update, offline edits, tombstones/conflicts and privacy.
Phase C: only if actual multi-user release demand proves the need, design a
minimum-supported-client protocol and graceful read-only/update UX that
preserves queued local writes. Do not add a compatibility proxy or force
service-worker activation speculatively.

See [Production release readiness](PRODUCTION_RELEASE_READINESS.md),
[backend workflow](APPWRITE_BACKEND_WORKFLOW.md), and [#914](https://github.com/carlers/mosaic-life-tracker/issues/914).
