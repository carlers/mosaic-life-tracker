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

Next action: finish focused verification of this batch. If green, inspect and repair confirmed remaining gaps before stable Preview handoff. Do not merge to dev/main absent user approval.
