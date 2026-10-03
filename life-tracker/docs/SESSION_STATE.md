# Session checkpoint

Updated: 2026-10-03
Current task: Fix repeated task/diary compatibility-bootstrap push failures reported by Sync Status on `fix/sync-reconciliation-errors`.
Status: Implementation is complete on `chatgpt/fix-sync-reconciliation-errors`. Partial legacy/bootstrap pushes are resumable across retries and reloads, 429 handling stops scheduling new writes after the first observed rate-limit failure, and Sync Status reports failed/deferred counts with the failure class. Focused verification is green after two behavioral-red regressions proved the original replay and remote-update defects. Full canonical acceptance is requested by this checkpoint commit.
Next action: Wait for exact-SHA full canonical acceptance. Fix any failure. If green, squash-merge the task branch into stable `fix/sync-reconciliation-errors`, verify the stable Vercel Preview is READY/HTTP 200, and leave promotion to `dev` for explicit user instruction.
Blockers: None known.

## Results

- Stable branch baseline: `38ffffeb` (latest `dev` state when the fix branch was created).
- Root cause in code: a partial compatibility push kept the old collection dirty boundary, so a retry replayed rows that had already succeeded; a large failed batch could therefore repeat the same successful prefix indefinitely.
- Successful bootstrap writes now persist an account/collection/row acknowledgement keyed to the exact local RxDB `_meta.lwt` revision.
- Retries skip only that exact acknowledged revision. Any later local edit has a new revision and is pushed normally.
- Acknowledged revisions are treated as clean during retry pull arbitration, allowing a genuinely newer remote row to win before RxDB handoff rather than being masked by the conservative dirty boundary.
- The acknowledgement set is cleared after a clean collection bootstrap advances its dirty boundary.
- On the first 429, at most the already in-flight workers finish; no new row writes are scheduled. Remaining candidates are deferred until the existing rate-limit backoff wakes the sync engine.
- Non-429 row failures still allow later independent candidates to run, preserving progress while recording successful revisions for the next retry.
- Sync Status compatibility errors now distinguish rate limiting, authorization, server/request, network, and unexpected failures and include failed/deferred counts.
- No schema, Appwrite backend, UI layout, product behavior, offline capability, or steady-state RxDB replication contract changed.

## Verification

- Behavioral red 1: `c3fd6653` failed because the original engine attempted all 12 dirty rows after the first simulated 429; expected at most the four already in-flight workers.
- Focused green after resumable-push implementation: `d8934682` Quality Gate focused checks passed.
- Behavioral red 2: `1cab8b22` failed because an acknowledged local revision still masked a newer remote row during retry pull arbitration.
- Focused green after acknowledged-revision pull fix: `2509df32` Quality Gate focused checks passed.
- Full canonical Quality Gate: requested by the final checkpoint commit.
- Stable Preview: pending squash promotion after canonical acceptance.
- Manual/device acceptance: not yet claimed.
