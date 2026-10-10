# Session checkpoint

Updated: 2026-10-10
Issue: #406 — shared tasks with friends, implementation authorized.
Task branch: `chatgpt/shared-tasks-contract` from `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1). `dev` and `main` unchanged.

## Implemented in Git, not deployed
- Server-only `task_shares` table, migration 007, transaction-backed invites and completion with independent per-invitee membership/grant epoch, idempotent command IDs and strict private-field allowlist. First invitation also fences legacy browser direct task updates via transactional row permissions, while current owner sync writes through Function CAS.
- Account-scoped durable offline completion and accept/decline/leave commands; stable desired state and revision/epoch checks, bounded retries, terminal failure persistence, multi-tab serialization where Web Locks exist, settlement-triggered refetch, sanitized per-user offline caches and erasure/logout cleanup.
- Explicit remote owner completion merge for independent local title/date edits, conflict warnings when owner and collaborator both changed completion, and a bootstrap guard when assumed-master metadata is absent. Shared-task follower Alerts are suppressed for any task with a sharing history, even after revocation, to prevent delayed misattribution.
- Creator Share BottomSheet, multi-friend invitations and revocations, Explore inbox, recipient virtual Shared Day View and pending indicators. Personal task categories/reorder, personal backup and recipient grant restore remain separate.
- Unit/handler/DOM regressions and schema expectations updated. Exact focused CI at `f031c965`: successful, [Actions run 38016558017](https://github.com/carlers/mosaic-life-tracker/actions/runs/38016558017). The subsequent notification/bootstrapping hardening commit needs focused verification.

## Observed read-only Scratch backend (2026-10-10)
- Target: disposable `My first project` `6a96e82d000d1310b3be` in fra. The managed `task_shares` table does **not** exist yet, so the new Function **must not** be activated.
- Existing `message-action` Function `6aa8057f002a4c306fdd`: active deployment `6ac7a40cba930ebdefea`, ready, runtime `node-18.0`, VCS provider installation/repository fields empty. Use the exact-SHA source package workflow; no VCS-linked deployment is available.
- Existing scratch `friendships` table reports `create("users")` permission, whereas the portable manifest expects `[]`. This permission drift needs reviewed reconciliation before app-level acceptance; no schema or Function mutation has occurred in Scratch or Production.

## Blocking acceptance work
- Fully route creator shared-task completion entry points (including bulk and keyboard) through a recoverable versioned owner intent path or prove the current owner RxDB outbox meets the offline command contract; display explicit owner pending status.
- Validate real Scratch transaction permissions, CAS/old-client behavior, friendship/race/notification, three synthetic accounts, two browser tabs/devices, offline/reconnect, account deletion and DR recovery; measure provider Appwrite Free limits before rollout.
- Full theme/a11y/browser/device acceptance; version collision check and MINOR stamp, stable Preview full canonical CI and Vercel READY. Main/dev release approval remains separate.

## Next
Verify current focused test commit; diagnose any failure and repair. Then resolve owner completion and Scratch permissions drift without touching Production. Do not create user-facing Preview or promote before the backend/client consistency contract and Scratch acceptance pass. Issue #406 tracks scoped findings.
