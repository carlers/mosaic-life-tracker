# Session checkpoint

Updated: 2026-10-02
Current task: Continue the incremental RxDB sync migration after the categories pilot and legacy P0 hardening, using diary as the second pilot.
Status: The legacy P0 reliability pass is merged into stable `perf/sync-engine-audit` at `2eb7e10e80a26e4efb4b7b40e2b813f7f5e1c5aa` and its Vercel Preview is READY. User reports category sync is working in hosted use. Diary RxDB replication is implemented on `chatgpt/sync-rxdb-diary-pilot`: it uses the same lossless pre-bootstrap checkpoint barrier, owner-scoped Appwrite `$updatedAt + $id` pulls, strict update/create writes, soft tombstones, and pilot-owned realtime. Tasks, settings, friendships, and messages remain on the hardened legacy engine. Settings was deliberately deferred because `profileImageId` has Storage upload/permission/profile-update side effects that need a dedicated adapter design rather than being treated as a simple scalar setting.
Next action: Run exact-SHA full canonical acceptance for the diary pilot, repair any failure, squash into `perf/sync-engine-audit`, verify the stable Preview, and perform diary create/edit/delete + offline/reconnect acceptance before selecting the third collection.
Blockers: None known in source. Live Appwrite diary tuple-query compatibility and hosted offline/reconnect behavior still require acceptance.

## Completed
- Legacy P0 reliability pass squash-merged into `perf/sync-engine-audit`; stable Vercel deployment for `2eb7e10e` is READY.
- Added `src/db/diaryReplicationPilot.ts` using generic RxDB replication over guarded Appwrite TablesDB.
- Preserved owner isolation, Mosaic soft tombstones, `updateRow` -> 404 `createRow`, and existing non-atomic Appwrite conflict semantics.
- Added pre-bootstrap local push-checkpoint capture and clean-bootstrap-only handoff so historical diary rows are not mass-repushed and writes made during bootstrap cannot be skipped.
- Switched diary steady-state pulls to server-authored `$updatedAt + $id` tuple checkpoints.
- Moved diary Appwrite Realtime ownership from the legacy realtime module to the RxDB pilot.
- Removed diary's delayed legacy mutation-sync trigger; RxDB now observes diary writes directly once the pilot is active, while offline/pre-handoff writes are covered by the legacy bootstrap/reconnect path.
- Kept the fresh diary tombstone `updatedAt` fix from the P0 pass.
- Added adapter and handoff regression coverage for checkpoint seeding, tuple pulls, strict create fallback, conflict preservation, realtime ownership, and refusal to hand off after incomplete legacy pagination.
- Final review found that the pre-existing restore/import `refreshSync()` barrier only nudged active RxDB pilots and could return before their pull completed. Category and diary now expose an awaitable leader-only freshness path using `awaitInSync()`; a newly-started pilot gets a bounded leadership-election grace period, and a non-leader tab fails restore/import closed instead of accepting stale data.
- Added regression coverage for leader-owned fresh pilot completion and non-leader fail-closed behavior.
- Updated `PROJECT_REFERENCE.md` and TodoMate import recovery notes with the two-pilot architecture and RxDB-aware freshness contract.

## Verification
- Legacy P0 stable Preview: READY at `2eb7e10e80a26e4efb4b7b40e2b813f7f5e1c5aa`.
- Diary pilot source/diff review: complete; one stale test assertion and one restore/import freshness regression were found and repaired during review.
- Exact-SHA full canonical acceptance: pending.
- Stable diary Preview and hosted diary acceptance: pending.
