# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #745 chat repair after permanent send denial; approved pre-1.0 reliability batch also audits #682 social Notifications and #858 slow-network view mounting.

## Live baseline / release boundary

- Protected `dev@b5590bf4ab2eef7729815ce408cc8d40734c4409` = owner-accepted v0.29.4, promoted from stable `fix/889-pre1-integration-20261016@c43c3c88fcbdb558bf933e77d82d91465da8952b` through PR #940. Dev [Quality Gate #39004957684](https://github.com/carlers/mosaic-life-tracker/actions/runs/39004957684) SUCCESS and matching Vercel READY. Production `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` = published v0.29.1. Never promote to dev/main or tag 1.0 without explicit new approval.
- #745 owner accepted normal, offline, 403 Not sent/Retry, re-friend and account isolation. The unread/inbox filter after unfriend remains intentional; #937 separately deferred until after 1.0.
- #682 rich social Alerts are built and on dev; genuine multi-device generic/detail push, privacy and notification-open acceptance remain unverified. #858 read-only source audit found no proven slow-network app-shell gate; authenticated throttled real-browser observation still outstanding.

## Isolated candidate v0.29.5

- Task branch `chatgpt/745-chat-reconcile-denied-20261017` and independent stable Preview `fix/745-chat-reconcile-denied-20261017` both created from exact above dev baseline. Scope: **frontend-only** Chat Sync correctness after a permanent 4xx send denial. Source `src/lib/chatReconcile.ts` previously queried all locally pending outgoing messages, while `messageDelivery.ts` deliberately leaves permanently rejected messages pending for explicit Retry/Discard. Thus an already denied message unnecessarily blocked the separate `repair_thread_all` and message freshness barrier even though no delivery was in flight.
- New behavior ignores **only the current owner's explicitly denied message IDs** in the Chat Sync pending-send barrier. Real pending sends still block; denied data remains local for user Retry/Discard. Server repair auth, message pairing, pending queue, account-scope and stable chat UX unchanged. Source-level diagnosis is not a claim that this was reproduced on a physical device.
- Add unit regressions for a sole denied row and mixed denied + genuinely pending rows, preserving existing unauthorized/owner-switch/freshness checks. Version patch 0.29.4 → 0.29.5 (package, lock root, appVersion); no Appwrite schema, Function, credentials, Production, shared Scratch, social push, or interface redesign.
- #682 and #858 are separately inspected but deliberately not changed without a failing automated contract or measured authenticated slow-network root cause; don't manufacture code churn. Their outstanding owner/device and platform probes remain explicit.

## Next safe action

- Run focused verification on final task SHA (`[verify:focused]`) and fix any failures. Squash into the dedicated stable Preview only after green; verify full canonical checks, exact source SHA and Vercel READY with Scratch build identity. Offer the new v0.29.5 stable Preview for human Chat Sync regression acceptance; no `dev` or `main` promotion before separate owner approval.
- #889 1.0 is blocked by #936 mandatory planning-only security/privacy audit and #914 live changed-backend/privacy/rollback verification, which require their own authorization. Preserve that scope and no 1.0 release.
