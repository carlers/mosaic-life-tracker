# Session checkpoint

Updated: 2026-10-02
Current task: Continue the incremental RxDB sync migration after hosted acceptance of category and settings, migrating the server-owned friendship cache next while preserving transactional friendship commands.
Status: Friendship RxDB replication is implemented on `chatgpt/sync-rxdb-friendships-pilot`, based from stable `perf/sync-engine-audit` at `59163a07`. Categories, diary, settings, and friendships now have generic `replicateRxCollection()` pilots over guarded Appwrite TablesDB; tasks and messages remain on the hardened legacy engine. Friendship upstream replication is validation-only and never writes Appwrite rows. Focused CI is green and this checkpoint requests exact-SHA full canonical acceptance.
Next action: Repair any full Quality Gate failure. If green, squash-merge the task branch into `perf/sync-engine-audit`, verify stable Vercel Preview + stable-branch full Quality Gate, then perform hosted friendship acceptance (send/accept/remove or block, offline queued intent/reconnect, and second-browser propagation) before selecting the next collection.
Blockers: No known source or Appwrite query-shape blocker. A read-only production probe confirmed the friendships table accepts owner-scoped `$updatedAt + $id` tuple pagination; existing indexes for `user_id`, `user_id + status`, and `friend_id` are available. Hosted friendship behavior remains the manual acceptance gate.

## Completed
- User accepted hosted settings sync on the stable Preview, clearing the settings migration gate.
- Added `src/db/friendshipReplicationPilot.ts` as the fourth incremental RxDB pilot.
- Preserved the existing friendship full-pull bootstrap before handoff so legacy optimistic/orphan cache rows are reconciled and incomplete/failed pulls cannot authorize the pilot.
- Friendship steady-state pulls use owner-scoped server `$updatedAt + $id` tuple checkpoints.
- Friendship upstream is validation-only: it reads the current remote master, acknowledges equal server-confirmed local cache state, resolves divergent local state back to the server master, and never calls browser `updateRow`/`createRow` for friendship rows.
- Preserved local friend-bio cache enrichment without treating it as a remote write.
- Added explicit physical-delete safety: a valid server-owned friendship accidentally removed locally is restored from the master; an already-absent master is acknowledged; only the known invalid legacy local IDs purged by `FriendsProvider` bypass a server lookup.
- Moved friendship Appwrite Realtime ownership into the pilot. Create/update events enter the RxDB pull stream; hard-delete events soft-delete only the matching owner-scoped local cache row, clear cached friend-calendar data, and request resync.
- Removed the now-dead friendship reconciliation branch from the legacy realtime module; legacy realtime now owns only tasks and messages.
- Extended safety-sensitive `refreshSync()` so restore/import awaits friendship `awaitInSync()` alongside category, diary, and settings in the RxDB leader tab.
- Kept friendship mutations on the durable command queue + transactional `message-action` Function, including expected-version state transitions and immediate application of confirmed Function responses.
- Added regression coverage for checkpoint seeding, tuple pulls, validation-only upstream behavior, server-master conflicts, missing-master tombstones, local bio enrichment, valid/legacy physical deletes, account isolation, realtime update/delete ownership, pilot handoff/refusal, and fresh-sync barrier participation.
- Updated `PROJECT_REFERENCE.md` with the four-pilot architecture and friendship server-owned-cache contract.

## Verification
- Category hosted sync: accepted by user.
- Settings hosted sync: accepted by user.
- Stable settings migration `59163a07`: Vercel READY and stable full canonical acceptance green.
- Friendship tuple-query read-only production probe: passed; existing friendship indexes are available.
- Friendship integrated focused Quality Gate: green through `a0d042c3`; subsequent documentation-only changes are contract-checked separately.
- Exact-SHA full canonical acceptance: requested by this commit.
- Stable Preview and hosted/manual friendship acceptance: pending promotion.
