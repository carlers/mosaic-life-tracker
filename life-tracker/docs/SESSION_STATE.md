# Session checkpoint

Updated: 2026-10-02
Current task: Finish the incremental RxDB sync migration by moving messages—the final legacy steady-state collection—to generic RxDB replication without changing the existing Function/outbox ownership of message delivery, read receipts, unsend, reactions, or account-data deletion.
Status: Message RxDB replication is implemented on `chatgpt/sync-rxdb-messages-pilot`, based from stable `perf/sync-engine-audit` at `546f5832`. All six synced collections now have generic `replicateRxCollection()` pilots over guarded Appwrite TablesDB. Messages use owner-scoped server tuple pulls plus a validation-only upstream; remote message writes remain owned by `message-action`, `deliverPendingMessages`, `messageActionQueue`, and the explicit Delete All Data tombstone path. Integrated focused verification is green after fixing a pre-existing nondeterministic restore-test timestamp fixture. This checkpoint requests exact-SHA full canonical acceptance.
Next action: Repair any full Quality Gate failure. If green, open/squash-merge the message task PR into `perf/sync-engine-audit`, verify the resulting stable Vercel Preview and stable-branch full Quality Gate, then perform hosted message acceptance before any legacy coordinator cleanup or merge to `dev`.
Blockers: No known source, schema, or Appwrite query-shape blocker. Read-only production probes confirmed both owner-scoped ascending `$updatedAt + $id` pagination and descending one-row remote-tail capture on the messages table; existing message indexes remain available. Hosted messaging behavior remains the manual acceptance gate.

## Completed
- User accepted hosted task replication and directed work to messages.
- Added `src/db/messageReplicationPilot.ts` as the sixth and final collection pilot.
- Preserved message remote-write ownership: the replication upstream is validation-only and never directly creates/updates message rows. Delivery, read receipts, unsend, reactions, cross-user writes, and retry queues remain on their existing Function/outbox paths.
- Added lossless message handoff: capture the local RxDB push seed and the owner's current remote `$updatedAt + $id` tail before one forced-full legacy message pull. The handoff is refused after row failure or incomplete pagination.
- Seeded RxDB's initial pull checkpoint at the captured pre-bootstrap remote tail. Historical remote rows are reconciled by the forced-full bootstrap rather than replayed through new replication, while remote writes racing after the captured tail remain newer and are pulled by RxDB.
- Steady-state messages use owner-scoped server `$updatedAt + $id` tuple checkpoints and Appwrite Realtime.
- Added local-intent reconciliation for known Function/outbox races: newer local unsend, optimistic reactions, unsend reply-snapshot wipe, legacy `originalMessageId` enrichment, incoming local read state while `mark_read` is pending, and local soft tombstones. Outgoing `readAt` remains server-owned. Newer remote mutations supersede older optimistic state.
- Moved message Appwrite Realtime ownership into the pilot. The legacy realtime module now owns zero table subscriptions and remains only as a lifecycle compatibility shell pending a later cleanup.
- Added `forceMessageSync()` so ChatPage's existing 30-second visible/online heartbeat resyncs messages only after handoff; pre-handoff it falls back to the compatibility coordinator.
- Extended safety-sensitive `refreshSync()` to await the message pilot alongside the other five pilots.
- Added regression coverage for local/remote checkpoint seeding, forced-full handoff/refusal, validation-only upstream, pending/read/unsend/reaction intent merges, outgoing server-owned read receipts, realtime updates/deletes, message-only chat heartbeat, owner isolation, and fresh-sync barrier participation.
- Fixed a pre-existing flaky restore fixture discovered by focused CI: the happy-path mock used a 1ms freshness margin that could invert under scheduler delay. The fixture now uses a deterministic 1s margin; production restore freshness checks are unchanged.
- Updated `PROJECT_REFERENCE.md` so all six collections are documented as RxDB steady-state replication, with the compatibility coordinator and message Function/outbox boundaries explicitly scoped.

## Verification
- Tasks hosted sync: accepted by user.
- Messages ascending tuple-query production probe: passed.
- Messages descending remote-tail production probe: passed.
- Existing messages indexes: available; no schema/index migration required.
- Standalone message replication pilot focused run: green.
- Integrated message handoff focused run after restore-fixture repair: green at `c270fba0`.
- Exact-SHA full canonical acceptance: requested by this commit.
- Stable Preview and hosted/manual message acceptance: pending promotion.
