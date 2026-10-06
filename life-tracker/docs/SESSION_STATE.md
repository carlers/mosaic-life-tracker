# Session checkpoint

Updated: 2026-10-06
Current task: Close the remaining active multi-device owner-write race and bound missed-Realtime convergence without slowing normal local-first startup.
Status: Implementation is on `chatgpt/fix-sync-convergence`. A disposable Appwrite proof showed server-side `updateRows` filtered by `$id + $updatedAt` behaves as compare-and-set under simultaneous writers: one request updates exactly one row and the stale competitor updates zero rows. The fix therefore reuses the existing trusted `message-action` Function for owner-row CAS with no schema migration, while a visible+online two-minute watchdog periodically requests incremental catch-up so a silently reconnected Realtime socket cannot leave an active device stale indefinitely.
Next action: Run focused verification, fix any failures, merge through a stable `fix/*` Preview branch for the canonical full gate, deploy/verify the updated `message-action` Function on scratch, and leave production Function activation plus `dev` promotion for the repository's explicit rollout/promotion steps.
Blockers: Production CAS is not effective until the new `compare_and_set_owner_row` Function action is activated. The client intentionally falls back to the previous direct owner update only when an older deployed Function reports the action as unknown, so staggered Preview rollout remains usable without pretending the race is closed before backend activation.

## Completed evidence

- Audited current `dev` owner-write pilots and confirmed tasks/categories/diary/settings still performed semantic master checks followed by unconditional browser `updateRow`, leaving a same-row read→write lost-update window.
- Confirmed Realtime events are wake-ups only and do not advance durable pull checkpoints, but the app had no bounded all-collection catch-up while it stayed visible/online after an invisible socket reconnect.
- Live disposable-project CAS proof: simultaneous server `updateRows` calls constrained by the same `$id + $updatedAt` token consistently produced one winner and one zero-row loser. No `sync_rev` column or new Function is required.
- Added a Git-owned `message-action` owner-write CAS handler that also constrains `user_id`, validates the owner-write table/data surface, and returns the current master to RxDB when CAS loses.
- Wired task/category/diary/settings updates through the CAS path while preserving strict create behavior, bootstrap semantics, task reaction-drift merge, and backward-compatible old-Function fallback.
- Added a 120-second visible+online sync watchdog directly in AppLayout's existing lazy sync wake-up path; focus/online/visibility triggers remain immediate and debounce with the watchdog.
- Added handler/client/pilot/watchdog regressions. Routine full anti-entropy remains intentionally deferred because the ordered server tuple checkpoint plus bounded incremental resync should first be stress-tested before adding full scans.

## Working files

- `appwrite-functions/message-action/main.js`
- `appwrite-functions/message-action/owner-write-cas.js`
- `src/db/ownerWriteCas.ts`
- `src/db/{task,category,diary,settings}ReplicationPilot.ts`
- `src/components/layout/AppLayout.tsx`
- `tests/handlers/ownerWriteCas.test.ts`
- `tests/unit/*ReplicationPilot.test.ts`
- `tests/unit/ownerWriteCas.test.ts`
- `tests/unit/syncWatchdog.test.ts`
- `docs/SYNC_SCENARIO_MATRIX.md`
- `docs/PROJECT_REFERENCE.md`
- `docs/PLAN.md`
