# Session checkpoint

Updated: 2026-10-02
Current task: Prove whether RxDB's generic replication engine can safely replace Mosaic's hand-built sync machinery one collection at a time, starting with categories, without changing the other five collection sync paths.
Status: The categories-only RxDB replication pilot and its lossless handoff repair are merged into stable `perf/sync-engine-audit`. Categories perform one clean legacy bootstrap, then hand off to generic `replicateRxCollection()` using a pre-bootstrap upstream seed; tasks, diary, settings, friendships, and messages remain on the legacy engine. Stable implementation SHA `d1b6c2a803233cdd1c8ce8e4eb4cafb15eee0e04` passed the full Quality Gate and has a READY Vercel Preview. A read-only production Appwrite probe confirmed the exact owner-filtered `$updatedAt + $id` tuple query is accepted by the current categories schema with no custom category indexes.
Next action: Perform hosted/manual acceptance on the stable Preview: real category create/update/delete, offline edit then reconnect, and second-browser/device propagation/conflict behavior. Do not migrate another collection until those checks are accepted.
Blockers: No automated/source/query-shape blocker. The remaining gate is real hosted offline/reconnect and multi-device acceptance.

## Completed
- Added a categories-only generic RxDB replication adapter over guarded Appwrite TablesDB; the official RxDB Appwrite plugin is not used.
- Preserved Mosaic owner scoping, soft tombstones, strict `updateRow` -> 404 `createRow`, category realtime ownership, and the existing non-atomic Appwrite conflict limitation.
- Switched category steady-state pulls to server-authored `$updatedAt + $id` tuple checkpoints.
- Made the migration boundary lossless: capture the RxDB push seed before legacy bootstrap and refuse handoff after any row-level pull/push failure or incomplete pagination.
- Page-cap/non-advancing legacy pulls retain the previous pull checkpoint and cannot run stale missing-row reconciliation.
- Added regression coverage for checkpoint capture/start separation, pre-bootstrap ordering, tuple pulls, strict create fallback, conflict returns, category realtime, and failed-bootstrap handoff refusal.
- Updated `PROJECT_REFERENCE.md` with the incremental pilot and lossless handoff contracts.

## Verification
- Original pilot full Quality Gate: green.
- Handoff-safety task code SHA `02bad9e7e4fc2f5bc0e51906396ac2e4b37a6c3b`: full Quality Gate green.
- Stable implementation SHA `d1b6c2a803233cdd1c8ce8e4eb4cafb15eee0e04`: project contracts, lint, unit/handler tests, both DOM shards, both browser-contract shards, production build, dependency audit, and `canonical-acceptance` all green.
- Stable Vercel Preview for the implementation SHA: READY.
- Read-only live Appwrite tuple-query probe: passed; current categories table reports no custom indexes.
- Hosted/manual category mutation, offline/reconnect, and second-browser/device acceptance: pending.
