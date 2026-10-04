# Session checkpoint

Updated: 2026-10-04
Current task: Finish production rollout of permanent account erasure and harden the DR privacy marker against object-lock retries.
Status: Permanent account erasure is on stable Preview `fix/new-user-onboarding-hardening` at `6c8219a`; focused/full canonical verification are green and the exact-SHA Vercel Preview is READY. Production Appwrite schema and both Function deployments are live. A rollout check exposed that the deterministic R2 privacy-deletion marker was not retry-idempotent under object lock; `chatgpt/privacy-marker-idempotency` now authenticates/reuses an existing marker instead of overwriting it.
Next action: Publish the marker-idempotency repair as one coherent focused-verification commit, repair failures if any, squash into stable Preview, rerun canonical acceptance, then redeploy only `dr-backup`. After re-read, use a deliberately disposable Mosaic account for the remaining end-to-end deletion acceptance. Promotion to `dev` remains user-controlled.
Blockers: The accidental rollout probe wrote one privacy-deletion marker for a non-production Auth ID (`6a96e813038ce6b66315`). No Mosaic Auth user/profile was associated with that ID and the deletion-job table is empty. Because the DR prefix is object-locked, that inert marker may remain physically undeletable until the lock window expires; restore filtering only matters if that exact custom user ID exists in a snapshot/target.

## Results

- Settings exposes **Delete Account** separately from **Clear Local Data** and requires exact typed confirmation `DELETE`.
- A server-only `account_deletions` row is the irreversible acceptance boundary. The worker hides the profile, disables Auth, revokes sessions, hard-deletes owned/cross-user live data and owned Storage files, scrubs supported peer references, verifies no live trace, deletes Auth last, then removes the job.
- DR writes encrypted privacy-deletion markers outside snapshot generations; restore authenticates them and prevents an erased account from being recreated from older immutable snapshots.
- Production schema rollout is complete:
  - `account_deletions` exists with server-only permissions/row security and both required indexes available;
  - `messages.idx_sender_id` and `messages.idx_recipient_id` are available.
- The first schema attempt failed atomically because Appwrite rejects a default on a required column. The manifest now keeps `attempts` required without a default; that repair passed focused and full canonical verification before the successful rollout.
- Production `dr-backup` is active on deployment `6ac210864f66010873e4` with its original read-only Appwrite scopes, secrets, daily schedule, 900s timeout, and new privacy-marker route.
- Production `message-action` is active on deployment `6ac2111928b0e7b709fa`; its code/schedule/variables are live. Current Appwrite documentation confirms server-side session deletion also requires `sessions.write`, so this repair adds that ninth execution-key scope before final acceptance.
- A privileged operator execution used by rollout unexpectedly inherited an Appwrite user header, so it was not a valid anonymous negative test. That inherited ID does not exist in Mosaic production Auth and had no profile. Its transient deletion job is gone and `account_deletions` is empty; no real Mosaic login was deleted or disabled.
- That probe exposed the important retry bug: the first DR marker PUT succeeded, but the worker's retry attempted to overwrite the same deterministic object and R2 object lock returned 409. The repair now:
  - HEADs the deterministic marker first;
  - decrypts/authenticates and validates an existing marker for the same user before reuse;
  - handles concurrent first-write races by authenticating the winning object;
  - fails closed if the existing marker is invalid rather than allowing deletion to proceed.

## Verification

- Main account-erasure task focused gate: passed.
- Stable Preview `28c5d5b`: full canonical acceptance passed; exact-SHA Vercel Preview READY.
- Appwrite schema compatibility repair focused gate: passed.
- Stable Preview `6c8219a`: full canonical acceptance passed; exact-SHA Vercel Preview READY.
- Production Appwrite schema/index migration: applied and re-read available.
- Production Function builds/configuration: both deployments built READY, activated, and re-read.
- DR marker idempotency automated coverage: added. The first focused run exposed an R2 test-double metadata omission; that fixture was repaired and verification was re-requested.
- Appwrite session-revocation scope parity: `sessions.write` added to both checked-in Function manifests and regression coverage; live Function config update waits for CI green.
- Remaining manual acceptance: use a disposable Mosaic account on hosted Preview/production backend, confirm immediate sign-out, cross-device session invalidation, live row/file cleanup, empty durable-job table after completion, and DR marker retry safety. Do not use an existing personal/friend account.
