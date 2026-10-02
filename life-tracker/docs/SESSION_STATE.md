# Session checkpoint

Updated: 2026-10-02
Current task: Continue the incremental RxDB sync migration after the accepted categories pilot and legacy P0 reliability pass, using settings as the second collection.
Status: Settings RxDB replication is implemented on `chatgpt/sync-rxdb-settings-pilot`, based from stable `perf/sync-engine-audit`. Categories remain on their accepted RxDB pilot. Settings now perform one clean legacy bootstrap and then hand off to generic `replicateRxCollection()`; tasks, diary, friendships, and messages remain on the hardened legacy engine. This checkpoint requests exact-SHA full canonical acceptance.
Next action: Repair any full Quality Gate failure. If green, squash-merge this task branch into `perf/sync-engine-audit`, verify the stable Vercel Preview, then perform hosted settings acceptance (normal setting changes, offline/reconnect, profile image, and second-browser propagation) before migrating another collection.
Blockers: No known source or Appwrite query-shape blocker. A read-only production probe confirmed the settings table accepts the owner-filtered `$updatedAt + $id` tuple query and currently has no custom indexes. Hosted settings behavior remains the manual acceptance gate.

## Completed
- Added `settingsReplicationPilot.ts` using RxDB generic replication over guarded Appwrite TablesDB; the official RxDB Appwrite plugin remains unused.
- Preserved the category pilot's lossless handoff pattern: capture the local push checkpoint before legacy bootstrap, require a clean legacy settings cycle, then seed RxDB upstream state without replaying historical settings.
- Switched settings steady-state pulls to server-authored `$updatedAt + $id` tuple checkpoints scoped by `user_id`.
- Gave settings replication ownership of Appwrite Realtime; the legacy realtime module no longer subscribes to settings.
- Preserved strict `updateRow` -> 404 `createRow`, soft `isDeleted` tombstones, owner checks, and remote-master conflict returns.
- Preserved offline profile-image behavior: pending profile images upload before the setting write, profile visibility/avatar side effects are retriable, pending blobs are retained across partial failure, and obsolete pending blobs are cleaned after server conflict resolution.
- Removed the redundant hook-owned legacy mutation trigger for settings because RxDB now observes settings writes directly.
- Added regression coverage for pre-bootstrap checkpoint capture, settings handoff/refusal, tuple pulls, strict create fallback, conflict handling, realtime ownership, pending profile-image transformation, profile side-effect retry, and pending-image cleanup.
- Updated `PROJECT_REFERENCE.md` for the second pilot and settings media/profile contracts.

## Verification
- Focused branch Quality Gate reached green on the complete runtime/test integration before final documentation cleanup.
- Read-only production Appwrite settings tuple-query probe: passed; settings table reports no custom indexes.
- Exact-SHA full canonical acceptance: requested by this commit.
- Stable Preview and hosted/manual settings acceptance: pending promotion.
