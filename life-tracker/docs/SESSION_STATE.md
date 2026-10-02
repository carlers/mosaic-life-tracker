# Session checkpoint

Updated: 2026-10-02
Current task: Prove whether RxDB's generic replication engine can safely replace Mosaic's hand-built sync machinery one collection at a time, starting with categories, without changing the other five collection sync paths.
Status: The categories-only pilot is merged into stable `perf/sync-engine-audit`, and the handoff-safety repair on `chatgpt/rxdb-category-handoff-safety` has passed full canonical acceptance at code SHA `02bad9e7e4fc2f5bc0e51906396ac2e4b37a6c3b`. The repair captures the RxDB upstream seed before bootstrap, requires a clean/complete category bootstrap before starting RxDB, and keeps pull checkpoints/reconciliation conservative when pagination is incomplete. A read-only probe against the live production categories table also confirmed the exact owner-filtered `$updatedAt + $id` tuple query is accepted with the current schema; no custom category index is currently required for that query shape.
Next action: Let the final docs-only head pass canonical acceptance, squash PR #204 into `perf/sync-engine-audit`, verify the new stable Vercel Preview, then perform real category create/update/delete, offline edit/reconnect, and second-browser/device acceptance before migrating another collection.
Blockers: No source or query-shape blocker. Real offline/reconnect and multi-device behavior still require hosted/manual acceptance.

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
- Full Quality Gate for repair code SHA `02bad9e7e4fc2f5bc0e51906396ac2e4b37a6c3b` passed: project contracts, lint, unit/handler tests, both DOM shards, both browser-contract shards, production build, dependency audit, and `canonical-acceptance` are green.
- A read-only live Appwrite probe confirmed the production category table accepts the pilot's exact `user_id` + `$updatedAt/$id` tuple filter/order query with no custom category indexes present.
- Final docs-only head canonical acceptance is pending.
- Hosted/manual create/update/delete, offline/reconnect, and second-browser/device acceptance is pending.
