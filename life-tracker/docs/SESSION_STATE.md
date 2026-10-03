# Session checkpoint

Updated: 2026-10-04
Current task: Fix the multi-device sync restart path that could misclassify remote-applied RxDB revisions as local dirty rows and trigger hundreds of unnecessary Appwrite writes/rate limits.
Status: Implementation, regression coverage, and documentation are complete on `chatgpt/multi-device-sync-rate-limit-audit`. The first focused gate passed. Stable Preview canonical acceptance then exposed one full-lint error in `taskReplicationPilot.ts` (`no-useless-assignment`); this repair removes that redundant initialization and requests focused verification on the actual TypeScript repair.
Next action: Inspect this focused repair gate. If green, squash the repair into `fix/multi-device-sync-rate-limit` and wait for a fresh full canonical acceptance + Vercel Preview. Promotion to `dev` remains user-controlled.
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

- Initial focused task Quality Gate: passed.
- First stable Preview canonical attempt: build and dependency audit passed; full `checks` failed on one ESLint `no-useless-assignment` error before unit execution.
- Focused repair Quality Gate: requested by this commit.
- Stable Preview canonical acceptance: pending repair delivery and rerun.
- Vercel Preview: first Preview build reached READY for the pre-repair SHA; final deployment pending repaired Preview SHA.
- Manual/device acceptance: recommended on phone + desktop with the same account after final Preview; confirm ordinary reload/focus does not surface `push/reconciliation` errors or mass rate-limit failures.
