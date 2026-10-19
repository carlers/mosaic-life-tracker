# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 isolated owner-scoped pending-conflict review and explicit keep-local CAS, not a shipped UI.

## Accepted source
- Accepted isolated Preview `refactor/967-signed-rxdb-http-20261019@2feea0854874eee7cba471713d00e8d8e3bc28da`, PR #1001. Canonical Quality Gate #39197309493 SUCCESS; real-signed local Chromium/RxDB lab #39197309638 SUCCESS (1 Playwright test, cleanup); trusted prebuilt READY #39197486425 SUCCESS.
- User authorized continuing Supabase work, **not** activating a backend migration or promoting dev/main/Production. Issue #967 OPEN.
- Protected dev `a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1`, main `b952f71ecd2add3172f90104bc0e856a2648ccc9`, isolated hosted mosaic-dev last read had 0 Auth users/tasks/categories, two unresolved privileged RPC security-advisor warnings.

## This task
- Task `chatgpt/967-pending-conflict-review-20261019` branched at accepted source. Source-only POC, tests and docs; no shipped React UI, SDK import, app version, real-user data or provider config changes.
- Extend `candidateRxdbPilot.ts` to record owner-validated pending conflicts (local, assumed master, current server master and revision), distinguish reasons, emit observable events, allow defensive-copy review and clear the scoped in-memory inbox on convergence, invalid session and stop. The original pending edits stay in RxDB durable storage; the 100-entry bounded in-memory review map is **not** a second data store. No automatic master-wins merge.
- Add **explicit manual keep-local** resolution requiring the exact reviewed server revision. Re-read the real isolated RxDB local document and current owner-scoped server master, check that both still match the reviewed versions, verify login epoch/token throughout, then CAS against fresh server revision. A concurrent race does not overwrite server master; it produces a new pending review. No automatic "discard my local draft" operation.
- Expand unit tests for surfaced review values, defensive copies, stale reviewed revision, intervening local/server writes, CAS race, owner-account switch and explicit resolved CAS. Expand dedicated signed-local Supabase/Chromium browser test to confirm both versions are reviewable and explicit keep-local CAS updates server only after user action.
- Evaluation doc records security/privacy and remaining UX design acceptance boundary.

## Verification
- Pending: final coherent task [verify:browser] gate including focused/typecheck, both browser shards, and dedicated ephemeral signed Auth browser lab; then isolated stable Preview canonical full and trusted delivery.
- No claim of verified conflict event/choice until CI and real signed browser lab pass.

## Next action
- Commit scoped POC and tests+docs as one task [verify:browser]. Diagnose and batch repairs without weakening data-loss/conflict/owner invariants. On green, squash to new isolated Preview, check canonical Quality Gate + trusted READY and log issue #967.
- Subsequent work: user-facing conflict review UX decisions, durable notifications across reload/account switch, safe keep-both/export and remote-choice policy, multi-tab/physical-device stress, hosted signed JWT/RLS/security-advisor acceptance, remaining six domains, media/DR and reversible cutover. No dev/main/Production promotion or 1.0 release without separate explicit approval.
