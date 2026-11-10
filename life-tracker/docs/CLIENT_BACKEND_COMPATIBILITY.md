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

## Current supported-release policy (2026-11-10)

The latest published Production release is **v0.82.7**, released 2026-11-07.
Its immutable tag `v0.82.7` targets
`main@2ef3cf2ea8aebb4ef46023a9e949bb4c12e26b8d`; both
`package.json` and `src/lib/appVersion.ts` at that SHA report `0.82.7`.
The exact-release Vercel Production deployment
`dpl_Bds3QmvtQMVxRPXs1VUoNxKaLKy6` is READY at that same SHA. Current
`main@ec9aae54e095a70581a9f86d79bd64c992ee83a7` still reports app version
`0.82.7`; the latest Production deployment readback is
`dpl_DBAKwQQMFs16LFnjofxT3Zbyy4kf` at that exact main SHA (issue #975,
2026-11-10). The current main head and release tag are different immutable
source pins and must not be conflated.

The source-level matrix now includes the latest `v0.82.7` release plus the
previous `v0.50.3` and conservative `v0.29.1` baselines. Their immutable
pins are respectively:
- `v0.82.7`: `2ef3cf2ea8aebb4ef46023a9e949bb4c12e26b8d`
- `v0.50.3`: `8cdfdf8573ded70b37db1c4b7a49e1d86d5ace89`
- `v0.29.1`: `b952f71ecd2add3172f90104bc0e856a2648ccc9`

The matrix is a conservative source-level test set, **not** a verified
inventory of physically installed PWAs. The last recorded owner report said
v0.29.1 was installed on laptop and phone (2026-11-02); no device-version
readback after v0.82.7 publication is recorded here. Do not infer current
installed versions from a source pin or from the latest release tag.

The owner confirmed every known v0.17.4 client synchronized and was retired
*before* approved Production migrations 010–015. The historical v0.17.4
source `bb58300052dc4c85974d97779e2b257ec4f28c7d` is **not certified as
compatible** with the expanded Diary/Message schema. The empty
`legacyPendingRetirement` list records the earlier owner attestation; it
does not establish device telemetry or retire any unobserved installation.
Records and rationale are preserved in
[issue #914](https://github.com/carlers/mosaic-life-tracker/issues/914).

This remains a **pre-public owner-controlled** policy. Before additional
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
