# Session checkpoint

Updated: 2026-10-02
Current task: Validate the completed six-collection RxDB sync migration in hosted use before removing the compatibility coordinator or merging the stable sync branch to `dev`.
Status: PR #211 (`perf: pilot RxDB message replication`) is squash-merged into `perf/sync-engine-audit`. Stable implementation commit `b96a0c5c` passed the full Quality Gate and its Vercel Preview is READY. All six synced collections—tasks, categories, diary, settings, friendships, and messages—now use generic `replicateRxCollection()` for steady-state replication over guarded Appwrite TablesDB adapters. The old custom sync engine remains only as a per-session bootstrap/resync compatibility layer pending a later cleanup after hosted acceptance.
Next action: Perform hosted message acceptance on the stable Preview. Exercise normal send/reply/task-reference delivery, offline pending send + reconnect, read receipts, unsend + reply-cascade behavior, reaction add/remove from both participants, and second-browser realtime propagation. If accepted, audit/remove obsolete legacy sync/realtime/checkpoint/backoff code in a separate cleanup task before considering merge to `dev`.
Blockers: No known automated or deployment blocker. Hosted message behavior is the remaining manual acceptance gate.

## Delivered
- Categories, diary, settings, friendships, tasks, and messages all have RxDB replication pilots.
- Message remote writes remain Function/outbox-owned: delivery uses `deliverPendingMessages`, transient read/unsend retries use `messageActionQueue`, peer-row/cross-user mutations use `message-action`, and Delete All Data retains its explicit tombstone writes.
- Message handoff captures local push state plus the remote `$updatedAt + $id` tail, runs one forced-full compatibility pull, refuses incomplete handoff, then starts RxDB from that captured remote tail.
- Message pull/realtime reconciliation preserves only documented local intents that may precede their Function result: unsend, optimistic reactions, reply-snapshot wipe, legacy `originalMessageId`, incoming read state, and soft tombstones. Outgoing `readAt` remains server-owned.
- Appwrite Realtime is owned by the six pilots. The legacy realtime module owns zero table subscriptions and remains only as a lifecycle compatibility shell.
- ChatPage's 30-second safety heartbeat uses `forceMessageSync()`, resyncing only messages after handoff.
- Safety-sensitive `refreshSync()` awaits all six pilots through the leader-owned freshness barrier.
- The old task-only 300ms local-mutation sync trigger is removed.
- A nondeterministic restore-test freshness fixture discovered during message CI was corrected without weakening production restore checks.
- `PROJECT_REFERENCE.md` documents the six-pilot architecture and domain-specific write ownership.

## Verification
- User-hosted acceptance already passed for categories, settings, and tasks; prior pilot delivery gates also completed for diary/friendships.
- Message ascending tuple-query production probe: passed.
- Message descending remote-tail production probe: passed.
- Message task-tip full canonical Quality Gate at `2c00ed08`: passed.
- Stable implementation `b96a0c5c` full Quality Gate: passed (checks, build, dependency audit, both DOM shards, both browser-contract shards, canonical acceptance).
- Stable implementation `b96a0c5c` Vercel Preview: READY/success.
- Merge to `dev`: not performed.
