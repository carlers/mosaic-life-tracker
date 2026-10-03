# Session checkpoint

Updated: 2026-10-04
Current task: Fix the multi-device sync restart path that could misclassify remote-applied RxDB revisions as local dirty rows and trigger hundreds of unnecessary Appwrite writes/rate limits.
Status: Implementation, regression coverage, and architecture/retention documentation are complete on `chatgpt/multi-device-sync-rate-limit-audit`. This checkpoint requests the focused task gate.
Next action: Inspect the focused Quality Gate for this commit. Fix any failure and rerun focused verification. Once green, squash the task into a stable `fix/*` Preview branch created from `dev`, then wait for canonical acceptance and Vercel Preview. Promotion to `dev` remains user-controlled.
Blockers: None known.

## Results

- Normal startup no longer runs the compatibility pull/push writer before inactive pilots. It starts/resumes the same versioned RxDB replication identifiers directly, so persisted RxDB checkpoints and pending offline writes own restart behavior.
- Added a local-only `syncMeta` RxDB collection that records per-account/per-collection settled replication freshness. Freshness is written only after RxDB initial replication completes and after later active→idle cycles; it is never synced to Appwrite.
- A >90-day freshness boundary now invokes read-only full recovery before that collection's pilot starts. The recovery may reconcile local rows but cannot call Appwrite `updateRow`/`createRow`; incomplete recovery blocks pilot start.
- Legacy `lastSyncTimePerCollection` remains only as a one-time stale-recovery fallback when no current DB-local freshness marker exists.
- Tasks/categories/diary/settings now handle `assumedMasterState === undefined` semantically: equal remote/local state is acknowledged without a write, newer remote state wins, and only a genuinely newer local application timestamp may update an existing row. Task bootstrap updates preserve current server reactions.
- Stale recovery preserves possible local edits with invalid/unknown timestamps, and preserves pending outgoing messages that are absent remotely.
- Replication identifiers are centralized/versioned, and data hooks explicitly exclude the local-only `syncMeta` collection.
- Removed the old compatibility push-ack/write-resume machinery and its rate-limit/deferred write path from normal sync coordination.
- Added regressions for the 320-row false-dirty restart shape, RxDB-first startup, semantic first-sync handling, settled freshness tracking/cancellation, read-only stale recovery, offline-edit preservation, pending-message preservation, freshness barriers, account generation changes, and Web Lock failure/timeout behavior.

## Verification

- Focused task Quality Gate: requested by this checkpoint commit.
- Stable Preview canonical acceptance: pending focused green + squash delivery.
- Vercel Preview: pending stable Preview delivery.
- Manual/device acceptance: recommended on phone + desktop with the same account after Preview; confirm ordinary reload/focus does not surface `push/reconciliation` errors or mass rate-limit failures.
