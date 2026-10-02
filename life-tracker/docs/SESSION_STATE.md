# Session checkpoint

Updated: 2026-10-02
Current task: Prove whether RxDB's generic replication engine can safely replace Mosaic's hand-built sync machinery one collection at a time, starting with categories, without changing the other five collection sync paths.
Status: The categories-only pilot is merged into stable `perf/sync-engine-audit` and its stable Vercel Preview is READY. Review found a migration-safety defect in the initial handoff: the RxDB upstream seed was captured after the legacy bootstrap, so an edit made during that gap—or a row whose legacy push failed silently—could be included in the seed without ever reaching Appwrite. The repair is implemented on `chatgpt/rxdb-category-handoff-safety`: capture the seed before bootstrap, require a clean/complete category bootstrap before starting RxDB, and keep pull checkpoints/reconciliation conservative when pagination is incomplete.
Next action: Run exact-SHA full canonical acceptance for the handoff-safety repair. If green, squash it into `perf/sync-engine-audit`, verify the new stable Preview, then perform hosted Appwrite category create/update/delete, offline edit/reconnect, and second-browser/device acceptance before migrating another collection.
Blockers: No source blocker. Hosted acceptance must still prove the live TablesDB compound `$updatedAt + $id` query/index shape and real multi-device behavior.

## Completed
- Added the categories-only generic RxDB replication pilot with Appwrite TablesDB pull/push handlers; tasks, diary, settings, friendships, and messages remain on the legacy engine.
- Kept Mosaic soft tombstones, owner scoping, strict `updateRow` -> 404 `createRow`, Appwrite realtime ownership, and the existing non-atomic conflict limitation.
- Switched steady-state category pulls to server-authored `$updatedAt + $id` tuple checkpoints.
- Identified and repaired the bootstrap seed race: the RxDB push seed is now captured before legacy bootstrap rather than after it.
- Category handoff now requires no row-level pull failure, no push failure, and complete pagination.
- Page-cap/non-advancing legacy pulls retain the previous pull checkpoint and cannot run stale missing-row reconciliation.
- Added regression coverage for pre-bootstrap seed ordering and refusal to start RxDB after a failed legacy category push.
- Updated the architecture reference with the lossless handoff contract.

## Verification
- Original category pilot task SHA `b1d9053bbc320faf5e07f6fd540e22e1cc0038a8` passed its full Quality Gate and was squash-merged as `d6acfc0c95c9256e3fa456f8204ae5a426e62a47`.
- Stable Preview for `d6acfc0c95c9256e3fa456f8204ae5a426e62a47` is READY.
- Exact-SHA canonical acceptance for the handoff-safety repair is pending.
- Hosted/manual Appwrite acceptance is pending.
