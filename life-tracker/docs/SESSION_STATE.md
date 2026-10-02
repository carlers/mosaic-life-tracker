# Session checkpoint

Updated: 2026-10-02
Current task: Continue the incremental RxDB sync migration after the accepted category pilot and legacy P0 reliability pass, reconciling the already-landed diary pilot with settings as the next collection.
Status: The combined implementation is on `chatgpt/sync-rxdb-settings-pilot`, now merged with stable `perf/sync-engine-audit` tip `1716f96d`. Categories, diary, and settings use generic `replicateRxCollection()` pilots over guarded Appwrite TablesDB; tasks, friendships, and messages remain on the hardened legacy engine. The settings adapter includes offline `profileImageId` upload/profile-side-effect recovery, and safety-sensitive `refreshSync()` now awaits all three active RxDB pilots in the leader tab. Reconciled focused CI is green. This checkpoint requests full canonical acceptance of the combined task tip.
Next action: Repair any full Quality Gate failure. If green, squash-merge PR #208 into `perf/sync-engine-audit`, verify the stable Vercel Preview, then perform hosted settings acceptance (normal setting changes, offline/reconnect, profile image, and second-browser propagation) before migrating another collection.
Blockers: No known source or Appwrite query-shape blocker. A read-only production probe confirmed the settings table accepts the owner-filtered `$updatedAt + $id` tuple query and currently has no custom indexes. Hosted settings behavior remains the manual acceptance gate.

## Completed
- Preserved the accepted category RxDB pilot and the merged legacy P0 reliability fixes.
- Reconciled the independently landed diary pilot into the settings task branch with a real two-parent merge; the task branch is no longer behind stable.
- Added `src/db/settingsReplicationPilot.ts` using generic RxDB replication over guarded Appwrite TablesDB; the official RxDB Appwrite plugin remains unused.
- Settings capture their local push checkpoint before one clean legacy bootstrap, then hand steady-state push/pull/realtime to RxDB. Failed row work or incomplete pagination refuses handoff.
- Settings pulls use owner-scoped server `$updatedAt + $id` tuple checkpoints; strict `updateRow` -> 404 `createRow`, soft `isDeleted` tombstones, and remote-master conflict handling are preserved.
- Settings now own their Appwrite Realtime stream and local change detection; the legacy realtime module excludes category, diary, and settings, and `useSettings` no longer schedules the legacy mutation trigger.
- Preserved offline profile-image behavior: pending images upload and become readable before the setting write; pending blobs survive partial profile-side-effect failure for retry, authoritative remote settings repair the profile side effect, and obsolete pending blobs are cleaned after server conflict resolution.
- Extended the fail-closed restore/import freshness barrier so `refreshSync()` awaits category, diary, and settings RxDB pilots through leader-owned `awaitInSync()`.
- Added settings adapter/handoff/realtime/profile-image/freshness regression coverage.
- The combined focused run exposed a stale diary update-404 test fixture inherited from the diary pilot: its default remote master differed from the assumed state, so production correctly returned a conflict instead of reaching the fallback path. The fixture now supplies a matching master; the reconciled focused run is green.
- Updated `PROJECT_REFERENCE.md` to describe the three-pilot architecture and settings media/profile contract.

## Verification
- User reports category sync is working in hosted use.
- Legacy P0 reliability changes are merged into stable and their Vercel deployment is READY.
- Settings tuple-query read-only production probe: passed; settings table reports no custom indexes.
- Settings task tip before diary reconciliation: full Quality Gate green.
- Reconciled category + diary + settings focused Quality Gate: green at `3554109f`.
- Exact-SHA full canonical acceptance: requested by this commit.
- Stable Preview and hosted/manual settings acceptance: pending promotion.
