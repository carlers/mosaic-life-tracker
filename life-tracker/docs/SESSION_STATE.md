# Session checkpoint

Updated: 2026-10-02
Current task: Continue the incremental RxDB sync migration by moving tasks off the hardened legacy engine while preserving task images, ordering, visibility, tombstones, and server-side friend reactions.
Status: Task RxDB replication is implemented on `chatgpt/sync-rxdb-tasks-pilot`, based from stable `perf/sync-engine-audit` at `10577943`. Tasks, categories, diary, settings, and friendships now have generic `replicateRxCollection()` pilots over guarded Appwrite TablesDB; messages are the only remaining collection on the legacy engine. Task Appwrite Realtime and local mutation observation are owned by the pilot. Focused task-adapter and integrated checks have passed during development; this checkpoint requests exact-SHA full canonical acceptance.
Next action: Repair any full Quality Gate failure. If green, squash-merge the task PR into `perf/sync-engine-audit`, verify the stable Vercel Preview and stable-branch full Quality Gate, then perform hosted task acceptance before migrating messages.
Blockers: No known source, schema, or Appwrite query-shape blocker. A read-only production probe confirmed the tasks table accepts owner-scoped `$updatedAt + $id` tuple pagination and currently has no custom indexes. Hosted task behavior remains the manual acceptance gate.

## Completed
- User explicitly directed the migration to proceed to tasks after the friendship pilot was delivered to the stable Preview.
- Added `src/db/taskReplicationPilot.ts` as the fifth incremental RxDB pilot.
- Task handoff captures the local push checkpoint before one clean legacy bootstrap and refuses handoff after row failures or incomplete pagination.
- Steady-state task pulls use owner-scoped server `$updatedAt + $id` tuple checkpoints.
- Existing task rows use `updateRow`; missing/new rows and update-404 fallback use strict `createRow` with owner row permissions. Mosaic `isDeleted` remains the soft tombstone; RxDB physical deletion is rejected by the adapter.
- Preserved offline pending task images: upload before the task row references the file, remove the pending blob only after a successful row write, retain it after failed writes for retry, clear it without upload on a deleted task, and clean obsolete pending blobs when the remote master wins.
- Added task-specific reconciliation for server-side friend reactions. If the current master differs from RxDB's assumed master only in `reactions + updatedAt`, an owner edit preserves the current server reaction string and later timestamp. Changes to owner-controlled task fields remain normal conflicts.
- Task Appwrite Realtime is now owned by the pilot; the legacy realtime module now subscribes only to messages.
- `useTasks` CRUD/completion/reorder writes are observed directly by RxDB. Removed the obsolete 300ms local-mutation legacy sync trigger and its now-dead unit test.
- Extended safety-sensitive `refreshSync()` to await the task pilot alongside category, diary, settings, and friendships.
- Added regression coverage for push-checkpoint seeding, tuple pulls, create/update-404 behavior, pending-image success/failure/delete/conflict paths, server reaction preservation, genuine master conflicts, realtime propagation, account isolation, handoff refusal, and fresh-sync participation.
- Updated `PROJECT_REFERENCE.md` so messages are the only remaining legacy sync collection and task-specific media/reaction contracts are explicit.

## Verification
- Task tuple-query read-only production probe: passed; tasks table currently reports no custom indexes.
- Standalone task replication pilot focused test run: green.
- Integrated task handoff/useTasks focused run after lint cleanup: green.
- Exact-SHA full canonical acceptance: requested by this commit.
- Stable Preview and hosted/manual task acceptance: pending promotion.
