# Session checkpoint

Updated: 2026-10-03
Current task: Audit and harden Mosaic sync against race conditions, account transitions, cross-tab queue loss, stale compatibility metadata, and safety-preflight false success.
Status: Implementation, documentation, and regression coverage are complete on `chatgpt/sync-engine-audit`. The first full task gate exposed three lint issues; the second exposed three test-fixture issues caused by the new account-scope contract. Those failures were investigated and repaired. A new full task gate is requested by this checkpoint commit.
Next action: Inspect the newly requested full GitHub Quality Gate. Fix any remaining failure, then squash the accepted task into a stable Preview branch created from `dev`. Wait for stable Preview canonical acceptance and Vercel Preview. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- `refreshSync()` now fails closed: inactive pilots, bootstrap errors, false pilot freshness, leadership/lock failures, owner changes, and deadline expiry cannot stamp fresh `lastSync` or offline readiness.
- Web Lock waiting is bounded by the caller freshness deadline. When the API exists but lock acquisition fails, compatibility sync no longer runs unlocked.
- Added lightweight authenticated-work generations shared by AuthProvider, sync, message delivery, and generic retry flushing. Login/signup/logout invalidate old work before session mutation; stale owners cannot publish status/backoff or continue scheduling writes.
- Added explicit sync-owner suspension and six-pilot teardown. Each pilot serializes start/stop lifecycle transitions so overlapping account replacement cannot orphan a live replication.
- Compatibility pull/dirty state, stale-missing suppression, and partial-push acknowledgements are now account-scoped. Matching legacy blobs migrate forward; when an older account's singleton blob was overwritten, its own successful `lastSyncTime_<userId>` is used as the clean recovery baseline.
- Generic message/social retry queues now persist one entry per account/dedup key rather than replacing one whole localStorage array. Compare-before-remove protects newer racing enqueues, Web Locks serialize flushes when available, and capacity is enforced per account.
- Message delivery is account-generation scoped. A newer owner request cannot be swallowed by an older in-flight delivery loop, and stale delivery results do not patch the old owner's local message as delivered.
- Stale-cursor full reconciliation preserves pending outgoing messages instead of interpreting a never-delivered local message as a remotely-garbage-collected row.
- Added/updated regressions for fresh-sync false success, Web Lock timeout/failure, account metadata isolation/recovery, cross-account backoff, cross-tab retry enqueue races, auth suspension ordering, delivery owner switches, pilot lifecycle overlap, and stale pending messages.
- Accepted Appwrite non-atomic read→write compare/update limitation remains unchanged.

## Verification

- Task-level full Quality Gate: rerun requested after fixing the lint and unit-fixture failures found by the first two full runs.
- Stable Preview canonical acceptance: pending after task verification.
- Vercel Preview: pending stable Preview delivery.
- Manual/device acceptance: not required for this non-visual data-synchronization hardening batch; hosted smoke testing remains useful after Preview.
