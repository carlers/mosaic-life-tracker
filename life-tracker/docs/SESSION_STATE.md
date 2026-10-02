# Session checkpoint

Updated: 2026-10-02
Current task: Harden the five legacy-sync collections after accepting the categories RxDB pilot in real use, then continue the incremental RxDB migration with settings.
Status: Legacy P0 reliability fixes are implemented on `chatgpt/sync-legacy-p0-reliability`, based from stable `perf/sync-engine-audit`. Categories remain on the accepted RxDB pilot. Tasks, diary, settings, friendships, and messages remain on the legacy engine for this acceptance unit. Full canonical verification is requested by this checkpoint commit; after it passes, squash into the stable sync branch, verify Preview, then start a separate settings-replication task branch.
Next action: Wait for exact-SHA full canonical acceptance. Repair any failure. If green, squash-merge this task branch into `perf/sync-engine-audit`, verify its stable Vercel Preview, then begin the settings RxDB replication pilot from the updated stable branch.
Blockers: None known in source. User reports category sync is working in current hosted use; broader category multi-device conflict acceptance remains ongoing but no longer blocks the legacy safety pass.

## Completed
- Legacy row-level pull/push/reconciliation failures now make the collection and account sync unsuccessful instead of allowing a false `lastSync` / offline-ready success.
- Preserved underlying row errors so 429, unauthorized, and ordinary transient failures retain correct classification.
- Legacy stale-cursor reconciliation now requires a complete, row-error-free pull; page-cap/non-advancing pulls cannot tombstone unseen local rows.
- Added per-tab self-waking backoff timers. Triggers during backoff re-establish the wake-up instead of silently depending on a later focus/reconnect event.
- Added `syncNow()` for user-invoked freshness: it drains same-tab work, may retry ordinary transient backoff immediately, and never bypasses active Appwrite 429 protection. Background/focus/chat triggers keep coalescing semantics.
- Task, diary, and settings writes now request a per-account 300ms debounced sync. This does not subscribe to generic RxDB writes, so remote/realtime applies do not create an echo loop.
- Diary deletion now stamps a fresh `updatedAt` with the tombstone, preserving 90-day retention semantics.
- Added regression coverage for false-success prevention, automatic retry wake-up, manual retry behavior, mutation-sync debounce, diary tombstone timestamps, and Sync Status manual freshness.
- Updated `PROJECT_REFERENCE.md` with the new sync contracts.

## Verification
- Source/diff review completed in chat against the current stable sync branch.
- Exact-SHA full canonical acceptance: pending.
- Stable Preview verification: pending until squash promotion.
- No settings RxDB migration changes are included in this acceptance unit.
