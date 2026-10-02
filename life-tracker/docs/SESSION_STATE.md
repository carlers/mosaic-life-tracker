# Session checkpoint

Updated: 2026-10-02
Current task: Finalize the six-collection RxDB migration, remove obsolete steady-state legacy sync/realtime machinery, and merge the stable sync branch to `dev` if verification remains green.
Status: Hosted message acceptance passed. Cleanup is implemented on `chatgpt/rxdb-sync-cleanup`, based on current `perf/sync-engine-audit` with zero commits behind. All six collections use RxDB for steady-state replication. Once all six pilots are active in the current JavaScript session, focus/reconnect/background `forceSync()` bypasses the custom reconciler and calls the six RxDB `reSync()` paths directly; manual Sync Now uses the six-pilot freshness barrier and records a fresh successful status. The obsolete shared realtime module and AppLayout realtime lifecycle were deleted. The compatibility bootstrap/checkpoint/backoff path is intentionally retained only for an inactive pilot because it still provides legacy-install handoff and 90-day stale-client/full-reconciliation safety.
Next action: Complete exact-SHA full canonical verification. If green, squash-merge the cleanup PR into `perf/sync-engine-audit`, verify that stable SHA's full Quality Gate and Vercel Preview, then merge `perf/sync-engine-audit` to `dev` and verify the resulting `dev` SHA. Do not promote to `main` in this task.
Blockers: No known source, test, deployment, or schema blocker. The compatibility bootstrap cannot yet be deleted safely without replacing its stale-client/full-reconciliation guarantee.

## Completed
- User accepted hosted message behavior, completing manual acceptance of the final RxDB collection.
- Added an all-pilots-active fast path in `src/db/sync.ts`: steady-state focus/reconnect/background triggers no longer load legacy per-collection cursors, Web Locks, or backoff logic.
- Manual `syncNow()` uses `refreshSync()` once all pilots are active; `refreshSync()` now publishes a fresh successful `lastSync` only after all six leader-owned freshness checks pass.
- Retained the compatibility reconciler only when at least one pilot is inactive. This protects legacy local edits during handoff and preserves the 90-day tombstone-GC stale-client recovery boundary.
- Removed `src/db/realtime.ts`, its AppLayout lazy lifecycle, and the obsolete legacy realtime test. Every table's realtime stream is now owned by its RxDB pilot.
- Added unit coverage proving `forceSync()` bypasses Appwrite legacy pull work after handoff and proving manual sync uses the six-pilot freshness barrier without legacy `listRows`.
- Updated `PROJECT_REFERENCE.md`, `TOMBSTONE_RETENTION.md`, `BACKUP_RESTORE.md`, and `PLAN.md` to distinguish steady-state RxDB replication from the retained bootstrap-only reconciler.

## Verification
- Cleanup code/test focused Quality Gate: green through `7b89d598`.
- Subsequent documentation contract checks: green through the latest completed docs commit.
- Exact-SHA full canonical acceptance: requested by this commit.
- Cleanup Preview/stable verification: pending promotion.
- Merge to `dev`: pending all required green gates.
