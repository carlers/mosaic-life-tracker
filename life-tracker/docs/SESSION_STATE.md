# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 owner-scoped conflict network suppression in unshipped Supabase RxDB pilot.

## Accepted base and boundaries
- Exact accepted isolated Preview: `refactor/967-pending-conflict-review-20261019@4d94aed050eb94d8da1c858fe0cdc581258a1738` via PR #1002. Canonical Quality Gate #39201478108, signed local Supabase/Chromium lab #39201478111, trusted CI-first Preview #39201673430 all SUCCESS. #967 OPEN.
- New task branch `chatgpt/967-conflict-retry-gate-20261019` from that exact SHA. Source-only Supabase fallback POC/tests/workflow/docs; version impact **NONE**. No shipped Mosaic `src/` imports, runtime backend switch, real accounts, hosted Supabase migrations/Auth, Appwrite, Vercel Production, dev/main or release work.
- Hosted project and security findings remain separately gated; two authenticated-callable SECURITY DEFINER Advisor WARNs not accepted/suppressed.

## Scope and changes
- Previously `candidateRxdbPilot.push` threw `CandidatePendingConflictError`; RxDB's `retryTime: 5_000` would repeatedly call `getVerifiedSession()` and remote master GET while waiting for a manual user decision.
- Preserve direct `push()` contract (typed conflict error for callers), but wrap **native replication push.handler** in `pushAfterReview`: catch only the typed pending conflict, park that batch on a document-scoped memory wakeup until the review is cleared; no timers, repeated Auth/user or PostgREST GET while a human decision is outstanding. Ordinary offline/network errors retain normal RxDB bounded retries. A resolved manual keep-local CAS wakes the batch, which re-verifies ownership and confirms master equivalence before advancing native RxDB durable push checkpoint.
- Shutdown / owner switch actively clears review and wakes parked handlers before awaiting `state.cancel()`, then rejects cancelled pending push, preventing hang or draft leakage. No duplicate checkpoint/conflict store; pending edits still persist in RxDB.
- Unit test uses mock native replication handler to prove no repeated Auth/master calls during unresolved conflict, exact CAS resolution then successful resume, and cancellation of parked push. Signed local browser spec measures master/Auth calls across a >5s hold then validates the previous signed CAS resolution/offline-reload/racing-writer behavior.
- Dedicated Supabase local-only workflow updated to run on the new isolated task/stable Preview family; evaluation doc records scope, limits and next UI needs.

## Verification
- Task coherent `[verify:browser]` commit, focused checks/both browser shards and dedicated signed local Supabase/Chromium integration **pending**. Fix any failures before isolated stable Preview merge. Then full canonical Quality Gate and trusted READY exact accepted SHA.
- No full user-facing conflict UX, hosted real signed users, true separate-device or 24-hour outage acceptance claimed.

## Next action
- Finish task verification, squash into fresh `refactor/967-conflict-retry-gate-20261019` stable isolated Preview, verify canonical + signed lab + trusted CI-first prebuilt READY, post issue #967 exact SHA and resume steps. Do not promote dev/main, change Production, alter hosted auth policy, or release 1.0 without distinct approval.
- Future: explicit review refresh / durable UX and safe save-both/export, multi-tab owner switches and bounded reconnect behavior, hosted privileged RPC audit and signed RLS acceptance, missing six domains, media/DR/budget and reversible cutover.
