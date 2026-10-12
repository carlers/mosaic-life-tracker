# Session checkpoint

Updated: 2026-10-12
Current task: #708 — chat delivery reliability and recovery, implementation on isolated task branch. No dev/main or Production promotion.

## Issue #708 first implementation batch
- Baseline: `dev@b878519bd52da16368b5da2b407f82f326ab2683` (v0.20.6). Task branch `chatgpt/708-message-reliability-20261012`; intended stable Preview `fix/chat-reliability-708-20261012`. GitHub issue #708 contains the hardened investigation and full acceptance plan.
- Initial code: trusted `message-action/deliver` refuses unverified getRow, conflicting/deleted/unsent pair state, and now returns retryable failure instead of falsely acknowledging failed sender creation. Uses createRow on new rows, preserves deterministic pair IDs, emits explicit messageId on success.
- Client now validates the `deliver` Function acknowledgment, retries transient pending sends with bounded exponential timers, preserves compose drafts if local insert fails, and blocks duplicate submit while persistence is pending.
- Chat header has an explicit Sync chat now control. It attempts pending delivery, awaits existing global `syncNow` freshness/reconciliation, and reports success/error without claiming peer-pair proof. Full reconciliation preserves an orphaned delivered outgoing message instead of silently tombstoning the sender's only local copy; it reports incomplete verification.
- Automated regression additions: partial sender create failure, non-404 backend read failure, unsent peer non-resurrection, partial retry, invalid delivery receipt, transient retry, compose insert error/double-send, and local orphan protection.
- User-facing Preview candidate: v0.24.0 (active concurrent feature lines include 0.21.0, 0.22.0, 0.23.1; recheck at promotion). Three standard version files updated.
- Scratch Appwrite observed read-only: `message-action` Function `6aa8057f002a4c306fdd` deployment `6accb9addc5321121ebb` active 2026-10-12; this code is **not deployed** there. Shared Scratch has concurrent Preview owners. No Scratch schema, Function, Vercel, or Production mutations performed.

## Remaining / gates
- Run focused CI at task SHA and repair failures; review behavior and performance costs, then squash into stable Preview for canonical CI/Vercel checks if safe.
- Backend-dependent Scratch deployment requires exact-SHA build and coordinated exclusive Function activation after existing Preview requirements are reviewed; do not activate an out-of-date Function or modify Production.
- Full #708 remains open: server peer-pair audit/repair for older partial histories, cross-device convergence/latency measurements, permanent-denial UX, reconnect/performance diagnostics, disposable-account and actual mobile browser acceptance. Do not claim global pair convergence from client-only Sync Now.
- #682 notification expansion stays deferred.

## Preview acceptance and size-budget repairs
- Task coherent focused Quality Gate 38241476695 **SUCCESS** at 734cad82.
- Task PR #715 squash-merged into stable Preview `fix/chat-reliability-708-20261012` at 9c296eed. Full canonical Quality Gate 38241874387 **SUCCESS**.
- Vercel deployment `dpl_6niRf8UU42RCCcmPdDAPpKrrxbtM` **ERROR**: all startup/Home/entry budgets passed, but total app assets raw +1,558 B, gzip +433 B and precache unique +1,365 B exceeded guard. **Do not raise budgets.**
- Repair task branch `chatgpt/708-build-budget-repair-20261012` based on 9c296eed: reuse existing lazily loaded Sync Status sheet from chat instead of duplicate sync state/feedback; compact per-owner exponential retry state. Existing Sync Now remains the actual confirmed freshness control.
- Repair #1 focused Quality Gate 38242472808 **SUCCESS**, PR #716 merged stable @ 590ab598; Vercel `dpl_8Wf2GYUiVdnCuLLT4TEZhUQpMbxE` still **ERROR**: total app assets raw +1,064 B, gzip +247 B, precache +871 B. Canonical Quality Gate for the first stable commit was green; verify the second separately.
- Repair #2 task branch `chatgpt/708-build-budget-repair2-20261012`: remove the extra chat-header Sync Status entry; **the existing global Settings Sync Now remains the manual reconciliation UX**. Delivery commit checks, automatic retry, compose protection and missing-local-copy guard stay unchanged.
- Repair #2 is **unverified**; no backend activation or user-testable Preview has been completed.

- Repair #2 PR #718 merged stable @ 22613ee3; full Quality Gate 38243099608 **SUCCESS**, Vercel `dpl_BkedDMzXLLFEPZitYucdJMJJsBre` **ERROR** (raw +475 B, gzip +94 B, precache +282 B), all other ceilings pass. No backend mutation.
- Repair #3 branch `chatgpt/708-size-guard-final-20261012` from 22613ee3: compact retry and receipt logic while retaining owner/generation, bounded exponential backoff and strict client ack checks. Pending focused verification. No product version bump or budget increases.

Next: focused verification → stable Preview PR → full canonical and Vercel guard. Only a READY Preview is browser-testable; Scratch Function must be separately and safely coordinated before claiming two-person delivery acceptance. Preserve dev/main and Production.
