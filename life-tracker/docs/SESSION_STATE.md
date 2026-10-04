# Session checkpoint

Updated: 2026-10-05
Current task: Audit the latest `dev` sync engine for missed race conditions and edge cases, build a durable scenario matrix, and implement justified fixes on `fix/sync-engine-race-matrix`.
Status: Audit/implementation is on task branch `chatgpt/sync-engine-race-matrix`, based exactly on `dev` commit `32f1c252`. The audit retained the documented non-atomic Appwrite compare/update window and stale-recovery client-clock ambiguity as accepted limitations, and found three additional correctness gaps that are now patched with regression coverage.
Next action: Run the focused Quality Gate for the final task checkpoint. If green, squash the task PR into stable Preview `fix/sync-engine-race-matrix`, then require the stable branch's full canonical acceptance and Preview deployment. Do not promote to `dev` or `main` without explicit user instruction.
Blockers: None known before CI.

## Audit findings implemented

1. **Freshness false-positive after retry/error:** a later RxDB `active → idle` transition previously refreshed `syncMeta.lastFreshAt` without proving `awaitInSync()`. A failed/retrying cycle can become inactive before convergence, which could incorrectly extend the 90-day tombstone-safety window. Later freshness marks now require `awaitInSync()`; cancellation does not stamp freshness.
2. **Old-owner teardown could cancel new-owner retry:** `suspendSyncOwner(A)` cleared the single global backoff wake timer before checking timer ownership. A delayed cleanup for A could therefore cancel B's newly scheduled retry. Teardown now clears the wake only when it belongs to the suspended owner (or when globally suspending).
3. **Realtime could advance the durable pull checkpoint past missed/out-of-order events:** all six pilots previously injected create/update payloads with their server tuple checkpoint. Realtime reconnect gaps are not a durable ordered change feed, so one later payload could skip an unseen earlier write. Create/update events now emit `RESYNC`; ordered pull handlers alone advance checkpoints. Friendship/message hard-delete local cleanup remains immediate, followed by resync.
4. **Remote owner drift was not handled consistently:** some owner-scoped pulls silently filtered a foreign remote row while other paths could map it. All six pull handlers, plus direct master reads for owner-write/friendship validation, now fail closed on a remote `user_id` mismatch.

## Durable coverage

- Added `docs/SYNC_SCENARIO_MATRIX.md` as the maintained sync risk/coverage inventory.
- Added regressions for retry-safe freshness, owner-scoped backoff teardown, Realtime checkpoint safety across all six pilots, and remote-owner mismatch behavior.
- Existing coverage remains for Web Locks, leader-only freshness, account-generation invalidation, stale recovery/tombstones, first-sync semantics, task reaction drift, pending media, message intent, and shared-local-DB foreign rows.
- The matrix explicitly separates automated coverage, implementation-only guards, hosted/manual provider behavior, and accepted architectural limits.

## Acceptance path

1. Final task commit requests `[verify:focused]`.
2. Focused-green task PR is squash-merged into `fix/sync-engine-race-matrix`.
3. Stable Preview runs the one routine full canonical gate and Vercel Preview.
4. Investigate and repair any failure on the task branch; repeat until canonical acceptance is green.
5. Report any remaining manual hosted/device checks separately.
