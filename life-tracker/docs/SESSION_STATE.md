# Session checkpoint

Updated: 2026-10-05
Current task: Complete the build-vs-reuse implementation on stable Preview `refactor/build-vs-reuse-audit`. The first stable full gate exposed that the Dexie experiment is not a net simplification, so `chatgpt/revert-dexie-prototype` removes that prototype while retaining the accepted replication-primitives refactor and live Appwrite evidence.
Status: R1 transaction CAS is rejected after live disposable-Appwrite proof; transaction reads do not fence a later staged write from an intervening external update. R2 behavior-preserving reuse is implemented: task/category/diary/settings share local push-checkpoint capture and owner-scoped Realtime→RESYNC mechanics while keeping domain push/conflict policy explicit. R3 direct Dexie reuse is rejected: the prototype passed production build/size checks but failed the existing pending-image owner-isolation DOM contract because Dexie captures IndexedDB dependencies at module initialization. Adding fake-IndexedDB/dependency-injection plumbing for a small helper would erase the maintenance win, so the native auxiliary IndexedDB wrappers remain.
Next action: Run focused verification for this Dexie-revert repair. If green, squash into `refactor/build-vs-reuse-audit` and rerun the stable branch's full canonical acceptance plus Vercel Preview.
Blockers: None known before CI.

## Accepted implementation

1. **No Appwrite transaction migration.** Live proof showed read→external update→stage→commit can still overwrite the external writer. Existing D1 remains explicit.
2. **Conditional `updateRows` CAS remains deferred.** It works with a revision predicate, but Mosaic has no dedicated collision-safe remote revision token; adding one is a schema/protocol redesign, not a reuse cleanup.
3. **Shared replication primitives stay.** `replicationPilotPrimitives.ts` centralizes the repeated checkpoint scan and owner-scoped Realtime wakeup for the four owner-write pilots. Domain mapping, equality, conflicts, create/update fallback, task image logic, settings profile logic, and collection-specific behavior remain local.
4. **Native auxiliary IndexedDB stays.** The direct Dexie dependency and `pendingImages.ts` prototype are removed after the full-gate DOM failure demonstrated extra test/runtime coupling for only modest source reduction. Friend and image caches were never migrated.

## Verification evidence so far

- Task branch focused Quality Gate `37260886935`: success.
- Stable squash commit before repair: `cf7b063d0abc5c861d6fa7c94d9de9b8e7372b04`.
- Stable full Quality Gate `37261263767`: production build/size, checks, dependency audit, DOM shard 1, and browser shard 1 passed; DOM shard 2 failed only `offlineCaches.test.tsx > keeps pending image blobs owner scoped` with Dexie `MissingAPIError IndexedDB API missing`. The Dexie prototype is therefore being reverted rather than weakening or replacing the regression test.

## Acceptance path

1. This repair checkpoint requests `[verify:focused]`.
2. Focused-green repair PR is squash-merged into `refactor/build-vs-reuse-audit`.
3. Stable Preview runs a fresh full canonical gate and exact-tree Vercel Preview.
4. No promotion to `dev` or `main` without explicit user instruction.
