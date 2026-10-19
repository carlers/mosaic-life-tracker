# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967/#975 provider-neutral signed owner-private acceptance runner with shared eight-domain fixtures.

## Baseline and boundary
- Accepted predecessor Preview refactor/967-cas-threat-fixture-20261019@6695cf3353b4ce1202a093ea1802d29fc561c855 (PR #1017); canonical Quality Gate #39224210760 and trusted Preview #39224436651 SUCCESS, exact prebuilt READY.
- Protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1, main@b952f71ecd2add3172f90104bc0e856a2648ccc9 at task start. OCI Appwrite #975 and Supabase Free #967 remain reversible competing options, neither selected.
- Only synthetic test harness, disposable localhost signed CI, and docs. No hosted Supabase Auth/schema/data, Appwrite Scratch/Production, OCI VM, shipped runtime, provider config, version or protected branch changes.

## Work
- tests/provider/ownerPrivateAcceptance.mjs: injectable provider-neutral two-signed-principal positive/negative owner-private contract for tasks/categories ONLY. Denies unimplemented six domains, foreign/anonymous access, forged inserts, unguarded DML, stale and foreign CAS, and validates monotonic owner-scoped cursors with tombstones.
- tests/e2e/supabase-signed-rxdb.ts exposes tasks/categories mapped from existing typed eight-domain fixture; signed disposable UUIDs are provided only by dedicated local CLI test.
- tests/e2e/supabase-signed-rxdb.spec.mjs adds genuine local Supabase signed Auth/PostgREST acceptance consuming fixture/runner. Original signed RxDB offline/restart/review tests unchanged.
- tests/unit/backendOwnerPrivateAcceptance.test.ts simulates leaky reads and revision bypass for fail-closed runner coverage; .github/workflows/supabase-signed-rxdb-browser.yml has scoped new task/Preview branch patterns and source triggers.
- Privileged CAS WARNs, writable reactions/created-at, server-owned social/message semantics and independent hosted signoff remain OPEN.

## Verification
- At checkpoint authoring, task focused, disposable signed CLI+Chromium, canonical stable Preview and trusted prebuilt delivery are PENDING, not proven.
- Signed service acceptance only covers owner-private tasks/categories on localhost; remaining six domains, OCI ARM64 feasibility, hosted signed Auth, formal security signoff, Auth continuity, media/Functions, DR, Free capacity and old-PWA-safe rollback are open.

## Next action
- Commit coherent chatgpt/967-provider-contract-* task with [verify:focused], run dedicated disposable signed browser lab, repair failures. Squash only after task focused and signed lab success to isolated stable refactor/967-provider-contract-*, require canonical full Quality Gate and trusted Preview READY, post exact evidence in issue #967. No dev/main/Production/1.0 promotion without separate explicit owner approval.
