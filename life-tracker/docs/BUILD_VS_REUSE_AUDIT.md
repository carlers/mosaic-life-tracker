# Build vs reuse audit

Audited: 2026-10-05  
Baseline: `dev` at `c0e4a62`  
Scope: production client/runtime infrastructure, synchronization, persistence, PWA lifecycle,
interaction infrastructure, backend schema/tooling, and major third-party dependencies.

This document began as an audit and now records the completed implementation results. The final refactor changes internal replication mechanics only; it does not intentionally change product behavior.

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
| P0 | Owner-write sync compare/update race | **Transaction approach rejected after live proof** | A transactional read does not fence a later staged write from an intervening external update, so this does not close Mosaic's actual read→compare→write window. Conditional `updateRows` can provide a predicate-based write but would require a new remote revision-token protocol, which is deferred. |
| P1 | Six RxDB replication pilots | **Selective primitive extraction implemented** | All six pilots now share local push-checkpoint scanning. Task/category/diary/settings additionally share owner-scoped tuple pulls and simple Realtime→`RESYNC` wakeups. Friendship/message retain custom pull and Realtime delete paths because they have cache/intent side effects. Lifecycle and domain policy stay explicit. |
| P2 | Raw IndexedDB wrappers | **Keep the native wrappers** | A direct Dexie prototype passed build/size checks but introduced module-initialization IndexedDB coupling that would require extra dependency-injection/test plumbing for only modest source reduction. The prototype was reverted; `idb` is not justified as a second experiment without a new measured need. |
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

## P0 — Appwrite transaction CAS was rejected

The owner-write task/category/diary/settings push path still has the documented read→compare→write
window. A live disposable-project proof tested whether TablesDB transactions could close it.

They cannot do so with Mosaic's current protocol: a transaction may read revision A, another
client may write revision B, and the first transaction can still stage and commit revision C
afterward. Appwrite does return a 409 when an external change happens after the transaction has
already staged its operation, but that is too late to protect Mosaic's earlier application-level
comparison.

A second live probe confirmed that query-conditioned `updateRows` can behave like a conditional
write. Safely adopting that approach would require a dedicated collision-safe remote revision
token across the owner-write schemas. That is a sync-protocol/schema project, not a reuse cleanup,
so the existing D1 limitation remains explicit instead of adding misleading transaction code.

## P1 — selective replication primitive extraction was implemented

RxDB remains the replication engine. The refactor centralizes only mechanics that proved genuinely
identical and leaves domain behavior visible.

`replicationPilotPrimitives.ts` now owns:

- local push-checkpoint scanning via `getChangedDocumentsSince` for all six pilots;
- owner-scoped `$updatedAt + $id` tuple paging, ownership validation, row filtering, mapping, and
  checkpoint construction for task/category/diary/settings;
- simple active-owner Realtime create/update/delete wakeups translated to `RESYNC` for those four
  owner-write pilots.

Friendship and Message deliberately keep custom pull/Realtime implementations because Friendship
invalidates cached calendars and applies hard-delete tombstones, while Message merges remote rows
with optimistic local intent and applies custom hard-delete state. Their checkpoint scan is shared,
but forcing the rest into generic hooks would move complexity rather than remove it.

The repeated start/stop/refresh lifecycle blocks also remain per pilot. A generic controller would
need to own typed RxDB state, Subjects, subscriptions, collection state, freshness labels,
identifiers, error labels, and collection-specific handlers. That configuration surface did not
pass the complexity-budget test.

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

## P2 — native auxiliary IndexedDB wrappers remain

A direct Dexie 4.4.2 prototype was implemented for `pendingImages.ts` using the existing
database/store/version contract. It passed the production build and size guard.

The stable full gate then exposed the more important tradeoff: Dexie captures its IndexedDB
dependency at module initialization, while Mosaic's DOM isolation tests intentionally inject an
isolated IndexedDB implementation per test. Making that prototype cleanly compatible would require
additional dependency injection or a fake-IndexedDB dependency for a relatively small helper.

That is not a net simplification. The Dexie prototype and direct dependency were reverted.
`pendingImages.ts`, `friendCache.ts`, and `imageCache.ts` stay native. An `idb` migration is
not planned unless a future concrete maintenance problem justifies reopening the measurement.

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

## Implementation result

### R1 — transaction CAS

**Rejected after live proof.** No owner-write pilot was migrated to Appwrite transactions. The
accepted D1 read→write race remains documented. Predicate-based conditional writes are deferred to
a future revision-token protocol only if real multi-device usage makes the limitation material.

### R2 — replication deduplication

**Completed selectively.** Shared checkpoint scanning is used by all six pilots. The four
owner-write pilots additionally share tuple-paged pulls and the simple Realtime wakeup path.
Friendship/Message keep their side-effectful pull/delete behavior local, and lifecycle orchestration
remains explicit rather than becoming a generic controller.

The shared primitive has direct unit coverage in addition to the existing per-pilot regressions.

### R3 — auxiliary IndexedDB

**Prototype rejected and reverted.** Dexie passed bundle/build checks but did not produce enough
maintenance benefit to justify its additional IndexedDB/test coupling. Native helpers remain.

## Conclusion

The audit and implementation do **not** support a broad dependency-adding rewrite.

Mosaic already delegates substantial commodity behavior to mature libraries. The worthwhile
cleanup was narrower: centralize replication protocol mechanics that were truly identical, and
leave product-specific conflict, side-effect, cache, message, PWA, and interaction behavior
explicit.

The implementation also prevented two counterproductive refactors. Live evidence showed that
Appwrite transactions would not close the actual owner-write race, and the Dexie prototype showed
that replacing the small native cache wrapper would add coupling for modest source savings.

After the final polish, this workstream is intentionally closed. Further abstraction should be
driven by a concrete bug, maintenance fan-out, bundle evidence, or a new product requirement—not
by duplication alone.

## 2026-10-05 implementation evidence

The transaction candidate was tested against a disposable Appwrite Cloud project before production code changed. The result invalidated the original CAS assumption.

- A transaction that **reads**, then another client updates, then the transaction **stages** its update can still commit and overwrite the intervening write.
- A transaction that stages its update **before** another client writes does conflict on commit with HTTP 409.
- Therefore Appwrite transaction conflict detection protects staged operations, not the earlier application-level read/compare decision Mosaic needs.
- Appwrite `updateRows` with equality predicates was also live-proven to behave as a conditional update (one matching row, then zero after the predicate became stale). Mosaic would need a dedicated remote revision token to use that safely across all mutable fields, so that is deferred rather than adding schema/protocol complexity solely to justify reuse.

R1 is therefore rejected. The accepted implementation proceeds only with behavior-preserving replication primitives; the later Dexie prototype was measured and reverted.


### Dexie prototype result

The first direct-Dexie prototype replaced the native `pendingImages.ts` wrapper while keeping the same IndexedDB database, version, store, key, pending-ID format, and owner checks. The production build and build-size guard passed, so bundle budgets were not the blocker.

The stable full gate exposed the more important tradeoff: Dexie resolves/captures its IndexedDB dependency at module initialization, while Mosaic's existing DOM contract injects an isolated IndexedDB implementation per test. Making the prototype pass cleanly would require dependency injection or an additional fake-IndexedDB test dependency. For a helper this small, that extra infrastructure outweighs the roughly twenty lines of source removed.

The Dexie prototype and direct dependency were therefore reverted. `pendingImages.ts`, `friendCache.ts`, and `imageCache.ts` remain native IndexedDB implementations. This is an intentional measured keep-custom decision, not unfinished migration work.


### Replication primitive extraction result

The implementation stopped at a deliberately narrow shared surface:

- local push-checkpoint capture via `getChangedDocumentsSince` is shared by all six pilots;
- task/category/diary/settings share owner-scoped Realtime create/update/delete wakeups translated
  to ordered `RESYNC`;
- those same four owner-write pilots share owner-scoped `$updatedAt + $id` tuple-paged pulls,
  including row ownership validation and checkpoint construction;
- Friendship/Message keep custom pull and delete handling because those paths perform cache or
  optimistic-intent side effects.

The remaining pilot lifecycle/start-stop blocks are visually similar, but extracting them would require a generic controller that owns typed RxDB state, Subjects, subscriptions, collection state, freshness labels, replication identifiers, error labeling, and collection-specific handlers. That would move complexity into configuration rather than remove it. The implementation therefore stops before that abstraction.

Task/settings side effects and every collection's push/conflict/mapping policy remain explicit in their pilot files. This satisfies the complexity-budget rule: common protocol mechanics have one implementation while product/domain behavior stays locally readable.
