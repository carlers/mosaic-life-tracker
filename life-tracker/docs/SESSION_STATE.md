# Session checkpoint

Updated: 2026-10-02
Current task: Prove whether RxDB's generic replication engine can safely replace Mosaic's hand-built sync machinery one collection at a time, starting with categories, without changing the other five collection sync paths.
Status: Implementation is on `chatgpt/sync-rxdb-categories-pilot`, based from stable `perf/sync-engine-audit`. Categories perform one legacy bootstrap sync, then hand off to a live `replicateRxCollection()` TablesDB adapter. The pilot uses Appwrite server `$updatedAt + $id` pull checkpoints, seeds RxDB's initial upstream checkpoint after the bootstrap to prevent historical mass re-push, preserves Mosaic soft tombstones, and owns the category realtime stream. Tasks, diary, settings, friendships, and messages remain on the legacy engine. Canonical acceptance is pending.
Next action: Run exact-SHA full canonical acceptance, repair any failures, then squash the accepted task branch into `perf/sync-engine-audit` and verify its stable Preview. Hosted acceptance must exercise real Appwrite category create/update/delete, offline edit/reconnect, a second browser/device, and the required tuple query/index shape before considering migration of another collection.
Blockers: None in source. The live Appwrite index/query compatibility and cross-device behavior require hosted verification; automated tests can prove adapter/query contracts but cannot prove the production TablesDB index accepts the compound tuple query.

## Completed
- Kept the official RxDB Appwrite plugin out of the runtime because it does not match Mosaic's guarded TablesDB contract.
- Added a categories-only generic RxDB replication adapter with bounded batches, automatic RxDB retry/leadership behavior, Appwrite realtime streaming, and Mosaic mapping/permissions.
- Preserved `isDeleted` as the application tombstone instead of mapping it to RxDB's physical `_deleted`.
- Added a safe migration barrier: legacy category sync first, then seed the RxDB push checkpoint from the local storage tip before live replication begins.
- Added server-authored `$updatedAt + $id` pull checkpoints with owner scoping.
- Preserved `updateRow` -> 404 `createRow` behavior and remote-master conflict detection; `upsertRow` is not used.
- Removed categories from the legacy realtime subscription so one remote event has one reconciliation owner.
- Added focused regression coverage for migration seeding, tuple pulls, strict create fallback, conflict returns, category realtime, and legacy-to-RxDB handoff.
- Updated the architecture reference to mark this as an incremental pilot, not a whole-engine migration.

## Verification
- Exact-SHA canonical acceptance pending.
- Hosted/manual Appwrite acceptance pending.
