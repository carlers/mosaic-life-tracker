# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1027 experimental signed two-domain native RxDB core sync coordinator; Supabase Auth lifecycle predecessor verification queued.

## Accepted starting point / permissions
- Last **accepted** isolated stable Preview refactor/1027-core-capability-reversible-20261019@1b09dee3ba3c2251bd5fb784a931541a0ee5cf85, canonical Quality Gate #39239546559 SUCCESS and trusted CI-first Preview #39239808796 READY.
- Previous task branch chatgpt/1027-core-auth-lifecycle-20261019@46af120df5671e5d30ad7bcc1b31eee89de8e771 contains source-only in-memory Supabase signed Auth lifecycle, no shipped AuthProvider switch. Focused CI #39279620091 and disposable signed lab #39279620505 were still **queued, not completed** on 2026-10-19 after creation, with no jobs executing. Do NOT present these as green.
- dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1, main@b952f71ecd2add3172f90104bc0e856a2648ccc9 protected. All eight Appwrite domains remain the shipped provider. #1027/#967/#975 OPEN, #1029 Diary immediately after a working, approved core-only release.
- No hosted Supabase Auth/data/schema changes, real-user migration, Appwrite/OCI writes, dev/main/Production promotions, paid infra or release approval. Preserve reversible Appwrite return and old-PWA-safe fencing.

## This unverified follow-up scope
- supabase-poc/candidateCoreRuntime.ts: composes actual task/category candidate RxDB pilots behind verified signed owner, separately asserted legacy Appwrite mapping, explicitly fenced Appwrite writers and exclusive writer lease. Both start together. Startup failure cancels partial pilots before releasing lease; unconfirmed cancellation retains exclusive lease. Rejects account mismatch, revoked lease, concurrent start, implicit Appwrite fallback.
- tests/unit/supabaseCandidateCoreRuntime.test.ts: adversarial guard, partial-start, owner-switch and cleanup regressions, synthetic only.
- tests/e2e/supabase-signed-rxdb.ts + spec.mjs: extend dedicated disposable real-Supabase Auth/Chromium/Dexie test fixture to start task and category native RxDB replications together. Add task creation/owner isolation/offline completion/closed-restart recovery/soft tombstone signed scenario. Older signed category conflicts and real Auth test remain.
- docs/CORE_MVP_PROVIDER_RETURN.md: explicit source-only coordinator and unknown true PWA writer-fence implementation. Does not wire real Appwrite shutdown, signed hosted Auth, or shipped Mosaic runtime.
- These changes build on preceding unverified Auth task SHA. Do not merge them into accepted stable Preview until focused and genuine disposable signed browser tests pass.

## Verification & active blocker
- At checkpoint authorship neither new unit/browser suite nor inherited Auth CI has run; GitHub Actions queue for previous task remains idle. Never weaken CI, real-JWT/DR or trusted prebuilt gates to proceed.

## Next action
- Commit coherent second task branch chatgpt/1027-core-two-domain-20261019 [verify:focused], update dedicated lab branch filters, and seek focused/signed lab verification. Resolve any TypeScript/security/device failures; squash into a new isolated stable Preview only after exact green, require full canonical and trusted prebuilt READY. If Actions stay queued, record blocker and preserve reviewable source commit without claiming acceptance.
- Continue actual Supabase AuthProvider/session restoration, source/target stable owner identity mapping, verified Appwrite writer fencing, real new tasks/categories across two devices and lossless reverse Appwrite migration. Diary #1029 is first after initial working core-only release. No dev/main/Production release without separate user approval.
