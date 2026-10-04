# Build vs reuse audit

Audited: 2026-10-05  
Baseline: `dev` at `c0e4a62`  
Scope: production client/runtime infrastructure, synchronization, persistence, PWA lifecycle,
interaction infrastructure, backend schema/tooling, and major third-party dependencies.

This is an audit only. It makes no runtime or product-behavior changes.

## Decision rule

Mosaic should reuse a maintained external component or platform feature when it removes
meaningful commodity code **without weakening Mosaic's behavioral contracts, offline model,
bundle budget, or maintainability**. Dependency count is not itself a quality metric.

This follows NIST SSDF PW.4: reuse existing well-secured software when feasible instead of
duplicating functionality, while still allowing well-secured in-house components when external
components do not fit the requirement.

References:

- NIST SSDF PW.4: <https://pages.nist.gov/nccoe-devsecops/appendix-c.html#c-3-4-practice-pw-4-reuse-existing-well-secured-software-when-feasible-instead-of-duplicating-functionality>
- OWASP Top 10 2025 A03, Software Supply Chain Failures:
  <https://top10.owasp.org/2025/A03_2025-Software_Supply_Chain_Failures/>
- RxDB generic replication: <https://rxdb.info/replication.html>
- RxDB Appwrite replication: <https://rxdb.info/replication-appwrite.html>
- Appwrite TablesDB transactions:
  <https://appwrite.io/docs/products/databases/tablesdb/transactions>
- Appwrite TablesDB type generation:
  <https://appwrite.io/docs/products/databases/tablesdb/type-generation>
- Workbox Background Sync:
  <https://developer.chrome.com/docs/workbox/modules/workbox-background-sync>
- `idb`: <https://github.com/jakearchibald/idb>

## Inventory

The largest custom infrastructure surface is synchronization.

- `src/db/sync.ts`: 1,452 lines / ~42.9 KB source.
- Six RxDB replication pilots: 3,371 lines / ~92.7 KB source combined.
- The six pilots share at least 134 normalized non-trivial source lines. The closest pair,
  category/diary, has a normalized line-set Jaccard similarity of 0.578. This is evidence of
  repeated replication scaffolding, not proof that domain-specific conflict behavior is
  interchangeable.
- `src/lib/outbox.ts`: 372 lines / ~9.9 KB.
- `BottomSheet.tsx`: 590 lines / ~19.9 KB.
- `PrimaryRouteSwipeSurface.tsx`: 354 lines / ~10.8 KB.
- `useBubbleGestures.ts`: 299 lines / ~8.6 KB.
- `pwaLifecycle.ts`: 364 lines / ~10.0 KB.
- Three modules directly own IndexedDB plumbing:
  `pendingImages.ts`, `friendCache.ts`, and `imageCache.ts`.

Source bytes measure maintenance surface only; they are not bundle-size measurements.

## Ranked findings

| Priority | Area | Decision | Rationale |
|---|---|---|---|
| P0 | Owner-write sync compare/update race | **Prototype Appwrite TablesDB transactions** | Mosaic already ships `appwrite@26.2.0`, whose TablesDB client supports transactions. Appwrite commits transaction operations atomically and reports a conflict if an affected row changed outside the transaction. The repo already uses this pattern in trusted friendship writes and repair tooling. This may close the accepted owner-write read→write race without a new dependency. |
| P1 | Six RxDB replication pilots | **Extract an internal TablesDB replication harness** | RxDB already owns replication state, conflict retry, checkpoints, and leader-owned execution. Mosaic repeats backend-neutral start/stop, checkpoint paging, Realtime RESYNC, ownership checks, and freshness wiring across six pilots. Keep collection-specific mapping and conflict/write policy injectable. |
| P2 | Raw IndexedDB wrappers | **Evaluate direct Dexie reuse first; `idb` only as fallback** | RxDB already resolves Dexie 4.4.2 and Mosaic actively uses `getRxStorageDexie()`, so Dexie is already part of the local-storage stack. Declaring/reusing it directly may remove repeated open/request/transaction boilerplate without adding a second IndexedDB abstraction. Compare against `idb` only if Dexie makes the auxiliary stores materially more complex or enlarges their loaded closure. |
| P3 | Appwrite schema typing | **Do not add a second schema source; evaluate only if Appwrite CLI config becomes canonical** | Appwrite can generate types from `appwrite.json`, but Mosaic's current source of truth is `infrastructure/mosaic-backend.mjs` and there is no `appwrite.json`. Adding generated types now would introduce another schema representation unless the provisioning source is deliberately migrated. |
| Watch | Official RxDB Appwrite plugin | **Do not adopt today** | Current upstream plugin code uses Appwrite's document/collection API (`Databases`, `listDocuments`, `createDocument`, `updateDocument`), while Mosaic is on TablesDB rows/tables. Migrating the backend only to consume this plugin would be a larger architectural change than the code it replaces. Re-evaluate if upstream gains TablesDB support. |
| Keep | Semantic message/social outbox | **Keep custom** | Workbox Background Sync stores/replays failed HTTP `Request` objects. Mosaic's outbox carries typed semantic intents with per-account dedupe, permanent-error policy, compare-before-remove protection, owner-generation cancellation, Web Locks, and domain rollback hooks. These contracts are not equivalent. |
| Keep | PWA lifecycle | **Keep the custom wrapper over vite-plugin-pwa** | Mosaic already delegates service-worker generation/registration primitives to vite-plugin-pwa. The remaining code implements Mosaic-specific install UI, waiting-worker activation, update progress, offline readiness, and delayed background prefetch. |
| Keep | Bottom sheet + nested Back/gesture arbitration | **Keep custom** | The sheet coordinates browser/Android Back history, nested sheets, vertical dismiss, Swiper/Embla ownership, focus, and existing Framer Motion behavior. Replacing it with a generic drawer/dialog would be a product-interaction migration, not a commodity-code substitution. |
| Keep | Focus trap | **Keep for now** | It has one call site and deliberately avoids geometry reads inside very large sheets. A general focus-trap dependency is mature but would add behavior/weight for a small contract. Revisit only if accessibility defects or additional modal surfaces appear. |
| Keep | Route/message gesture helpers | **Keep for now** | Their priority rules are product-specific and already coexist with Swiper, Embla, Framer Motion, and dnd-kit. Adding another gesture library would increase recognizer overlap unless it can replace a full interaction owner. |
| Keep | Embla + Swiper split | **Do not consolidate without bundle evidence** | They serve different accepted interaction contracts with substantial regression coverage. Removing one solely to lower dependency count would create migration risk without a demonstrated runtime or bundle win. |
| Keep | Backup/import/export and validation | **Keep domain code; continue using existing libraries** | Mosaic already uses AJV, fflate, browser-image-compression, RxDB, and Appwrite for the commodity parts. The remaining code is format mapping, privacy, recovery, and migration policy. |
| Keep | Connectivity state | **Keep custom** | Mosaic intentionally distinguishes browser link state from confirmed Appwrite reachability and offline-auth state. A plain online/offline helper would lose that contract. |
| Keep | Minimal PostHog adapter | **Keep custom by existing bundle/privacy decision** | Project §24.15 explicitly rejects the full browser SDK because the aggregate/precache budget has no room for it. The current adapter implements only error ingestion and feature-flag evaluation, with autocapture/session replay/product analytics structurally absent. Replacing it with the SDK would reverse an already measured optimization rather than remove accidental reinvention. |

## P0 — use Appwrite transactions for owner-write replication

The most important finding is not a new package.

The current task/category/diary/settings replication push path performs a remote read, compares
it with RxDB's assumed master, then performs a create/update. The documented limitation is
that another client can change the remote row between the read and write. Subsequent
replication repairs the race, but the write itself is not compare-and-swap atomic.

Appwrite TablesDB now exposes client transactions. The installed browser SDK already accepts
`transactionId` on row operations; `sdk.ts` even includes that field in its handwritten
row parameter shapes. The wrapper simply does not currently expose
`createTransaction`/`updateTransaction`.

The repository also already has a proven transaction pattern:

- `appwrite-functions/message-action/friendship.js` reads rows inside a transaction, stages
  writes, commits, retries 409 conflicts, and rolls back failures.
- `scripts/lib/friendship-repair.mjs` audits rows inside one transaction before applying
  repairs.

Appwrite's transaction contract states that commit fails with a conflict when an affected row
changed outside the transaction. That makes a transaction-scoped read → compare → stage write
a plausible way to make the owner-write pilot decision atomic.

This is **not yet an implementation recommendation without a proof**. The next change should
first add a focused two-client concurrency regression/sandbox proof that:

1. client A reads the assumed master inside a transaction;
2. client B changes the same row before A commits;
3. A's commit returns a conflict rather than overwriting B;
4. the pilot translates that conflict back into the actual current master for RxDB;
5. create-vs-create, update-vs-delete/tombstone, lost-response retry, and account-generation
   cancellation remain safe.

If that proof passes, this should replace the current accepted read→write race rather than
adding another synchronization library.

## P1 — consolidate replication mechanics, not replication policy

Mosaic is already using the correct class of library: every pilot calls RxDB's generic
`replicateRxCollection()`. RxDB already provides replication state, push conflict handling,
retry, checkpoints, Realtime-triggered resync integration, and multi-tab leader behavior.

The duplication is mostly in Mosaic's TablesDB adapter around that engine. A shared internal
harness should own only mechanics that are genuinely invariant:

- active owner/replication/stream/subscription lifecycle;
- serialized start/stop transitions;
- tuple checkpoint paging by `$updatedAt + $id`;
- validation of owner-scoped remote pages;
- Realtime subscription → `RESYNC` wakeup;
- common local push-checkpoint capture;
- common `isActive`, `resync`, `refresh`, and teardown wiring;
- shared batch/retry defaults where they are actually equal.

Keep these as explicit per-collection callbacks/configuration:

- Appwrite table and mapper;
- state equality;
- owner-write versus server-owned push semantics;
- image upload/profile mirroring;
- message optimistic-intent merge;
- friendship cache invalidation;
- social-reference sanitization;
- special conflict behavior.

Do **not** attempt a single generic "sync everything" abstraction. The goal is to remove
repeated mechanics while keeping domain rules visible and testable.

## Why not replace RxDB/Appwrite with another sync product

A sync-stack migration does not currently pass the cost/benefit test.

- Appwrite's own offline-sync guidance points JavaScript applications to RxDB.
- PowerSync is centered on a separate sync service connected to supported source databases and
  a SQLite client; adopting it would change both client storage and backend architecture.
- ElectricSQL is Postgres-centered, so it would imply a backend migration.
- Replicache can target custom backends but is now in maintenance mode and would still require
  Mosaic-specific push/pull endpoints and migration away from RxDB.

The current issue is therefore not "Mosaic chose the wrong sync library." It is that the
TablesDB adapter has accumulated repeated mechanics and has not yet adopted every useful
capability of the backend it already uses.

## P2 — reuse the existing IndexedDB stack before adding another wrapper

`pendingImages.ts`, `friendCache.ts`, and `imageCache.ts` each manually wrap
`indexedDB.open`, `IDBRequest`, upgrade handling, and transaction setup.

The lockfile already resolves `dexie@4.4.2` through RxDB, and Mosaic uses
`getRxStorageDexie()` for its primary local database. The first prototype should therefore
add Dexie as an explicit direct dependency at the already-resolved version and test whether
these three auxiliary stores become simpler while reusing the runtime already present in the
production graph. If Dexie is too high-level for these tiny stores, compare it with `idb`,
which stays close to the native IndexedDB API while converting requests to Promises.

Neither option should replace:

- pending-image owner checks;
- friend-calendar account-keyed TTL semantics;
- image-cache byte budget and LRU metadata;
- best-effort failure behavior required for cache-only data.

Before adoption, measure the production bundle/static-closure delta and confirm all existing
IndexedDB regressions pass. Prefer the option that removes the most maintenance code with no
new loaded-runtime cost; if neither does, keep the native implementation.

## Appwrite type generation: useful, but only with one schema source

Appwrite's CLI can pull TablesDB schemas and generate TypeScript definitions. This could
reduce handwritten row-shape casts in the future.

Mosaic currently provisions from `infrastructure/mosaic-backend.mjs`, and tests intentionally
treat that portable manifest as a contract. There is no `appwrite.json` in the repository.
Adding generated types from a separately maintained Appwrite config would create the exact
kind of schema drift this project is trying to prevent.

Only adopt Appwrite-generated types if the project first decides that Appwrite's CLI config
will become, or will be deterministically generated from, the same canonical manifest. A
manual second schema definition is rejected.

## Explicit non-candidates

The following custom code should not be refactored merely because a package exists:

- `useFocusTrap.ts`: one call site and a documented large-sheet performance constraint.
- `replicationPilotLifecycle.ts`: a tiny promise-tail serializer; a dependency would be
  larger conceptually than the implementation.
- small timeout/retry loops where the retry policy is only a few lines and domain-specific.
- `profileCache.ts`: minimal best-effort localStorage convenience cache.
- `posthog.ts`: the direct HTTP adapter is deliberate; §24.15 records that the full PostHog browser SDK exceeded the reviewed aggregate/precache budget and the minimal adapter is also the privacy boundary.
- interaction code whose purpose is arbitration among already-installed gesture owners.
- backend bootstrap, DR, account-erasure, TodoMate mapping, and restore policy: these encode
  Mosaic's own infrastructure/data contracts.

## Recommended implementation sequence

### Batch R1 — transaction CAS proof and owner-write pilot migration

1. Expose guarded TablesDB transaction methods from `src/lib/sdk.ts`.
2. Write a deterministic concurrency test for transaction conflict behavior at the adapter
   boundary, plus the normal pilot conflict regression.
3. Prototype one simple owner-write pilot (category or diary).
4. Verify create/update/tombstone, lost-response, multi-device, and account-switch scenarios.
5. If accepted, migrate task/settings and remove the old race limitation from the sync docs.

Expected benefit: correctness first; no new runtime dependency.

### Batch R2 — shared TablesDB/RxDB pilot harness

1. Extract common lifecycle, pull paging, ownership validation, checkpoint capture, and Realtime
   wakeup mechanics.
2. Migrate category + diary first because their pilot structure is the closest.
3. Re-run their focused suites and diff behavior before touching task/settings.
4. Migrate task/settings, then server-owned friendship/message only where the same mechanics
   genuinely apply.
5. Compare production bundle and source-size metrics before/after.

Expected benefit: lower maintenance surface and fewer places for future sync fixes to diverge.

### Batch R3 — auxiliary IndexedDB wrapper evaluation

1. Record a production bundle/static-closure baseline.
2. Declare the already-resolved Dexie version directly and migrate `pendingImages.ts` first.
3. If Dexie remains simpler with no material loaded-closure increase, migrate friend/image caches.
4. If Dexie is awkward for these stores, run the same experiment with `idb` instead; do not ship both abstractions without a measured reason.
5. Keep cache policy/failure behavior unchanged and remove any added direct dependency if the code/bundle reduction does not justify it.

Expected benefit: modest boilerplate reduction; low product impact.

### Deferred/watch items

- Recheck RxDB's Appwrite plugin when it supports TablesDB directly.
- Revisit Embla/Swiper consolidation only if a bundle audit identifies a material duplicated
  cost.
- Revisit a generic focus-trap library only if modal scope grows or accessibility evidence
  shows the current trap is insufficient.
- Revisit Appwrite-generated types only if Mosaic converges on a single Appwrite schema source.

## Conclusion

The audit does **not** support a broad dependency-adding rewrite.

Mosaic already delegates many hard commodity problems to mature libraries. The highest-value
refactor is to use more capability from the stack already present: Appwrite transactions for
atomic sync decisions and a shared internal adapter around RxDB replication. Reusing the Dexie runtime already
present through RxDB is the clearest auxiliary-storage candidate; a new IndexedDB library is
only a measured fallback. Most other custom infrastructure is
either deliberately thin or encodes Mosaic-specific offline, account-isolation, PWA, and
gesture behavior that generic packages do not replace.
