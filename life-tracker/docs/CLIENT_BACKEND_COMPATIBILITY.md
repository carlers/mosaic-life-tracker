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

## Current supported-release policy (2026-10-16)

**Published v0.29.1** is the first current source baseline for future
schema/Function compatibility decisions. The policy pins its exact immutable
Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` merge commit,
which is also the [published v0.29.1 Release](https://github.com/carlers/mosaic-life-tracker/releases/tag/v0.29.1)
tag target. The earlier `d51a9c6...` integration build was never a
separately shipped release and is no longer the support-policy pin.

The owner confirmed every known v0.17.4 client synchronized and was retired
*before* approved Production migrations 010–015. The owner subsequently
installed v0.29.1 on both laptop and phone and reported normal app behavior.
Consequently `legacyPendingRetirement` is currently empty. The historical
v0.17.4 source `bb58300052dc4c85974d97779e2b257ec4f28c7d` is **not
certified as compatible** with the expanded Diary/Message schema; clearing its
retirement gate is not equivalent to fixing that incompatibility. Records and
the rationale are preserved in [issue #914](https://github.com/carlers/mosaic-life-tracker/issues/914).

This is a **pre-public owner-controlled** policy. Before additional
independent users install Mosaic, agree on a supported-version window and
verify genuine offline PWA update/old-writer semantics via
[the Phase B rehearsal](COMPATIBILITY_REHEARSAL.md). Each newer published
version must explicitly review and update the pinned source list; do not
silently replace a still-installed supported release with the newest build.
No feature Preview, schema change or healthy current phone install proves
that an offline *older* client can safely reconnect to a newer backend.

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

#914 Phase B: follow the [isolated live rehearsal](COMPATIBILITY_REHEARSAL.md)
for old/new Appwrite consumers, waiting service workers, offline edits, tombstones,
conflicts and privacy. The checklist itself does not constitute a passing test.
Phase C: only if actual multi-user release demand proves the need, design a
minimum-supported-client protocol and graceful read-only/update UX that
preserves queued local writes. Do not add a compatibility proxy or force
service-worker activation speculatively.

See [Production release readiness](PRODUCTION_RELEASE_READINESS.md),
[backend workflow](APPWRITE_BACKEND_WORKFLOW.md), and [#914](https://github.com/carlers/mosaic-life-tracker/issues/914).
