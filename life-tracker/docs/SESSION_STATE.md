# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1027 signed Supabase Auth + two-domain core RxDB pilots, unaccepted while GitHub Actions runners remain unassigned.

## Live baseline and permissions
- Last accepted isolated Preview: refactor/1027-core-capability-reversible-20261019@1b09dee3ba3c2251bd5fb784a931541a0ee5cf85 (full canonical #39239546559 SUCCESS, trusted prebuilt #39239808796 READY).
- Task 1: chatgpt/1027-core-auth-lifecycle-20261019@46af120df5671e5d30ad7bcc1b31eee89de8e771. Queued focused #39279620091 and signed local Auth lab #39279620505; ZERO passed claims.
- Task 2: chatgpt/1027-core-two-domain-20261019@d7f70e98d1329ab0d60040939466319e558796f7, based on task 1. Queued focused #39280874284 and signed local lab #39280874242; ZERO passed claims. First jobs remained QUEUED, unassigned to runner at last check. GitHub connector/API functioning; unknown account/runner cause. Avoid repeated new CI commits just to poll.
- Protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1, main@b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged. Appwrite remains full eight-domain shipped backend. #1027/#967/#975 OPEN, Diary next after working released core #1029.
- No user hosted Supabase Auth/schema/data, legacy migration, Appwrite/OCI VM, dev/main/Production promotion, provider env switch, paid resources or release. Reversible Appwrite return remains binding.

## Source work
- Auth pilot: supabase-poc/candidateAuthSession.ts in-memory email/password login, signup, recovery, refresh, logout, signed /auth/v1/user verification, epoch account switching, no persistence; tests/unit/supabaseCandidateAuthSession.test.ts plus disposable signed browser real JWT scenario.
- Core pilot: supabase-poc/candidateCoreRuntime.ts starts native RxDB tasks+categories with checked owner, injected genuine legacy mapping, audited Appwrite writer fence and exclusive writer lease; partial startup cancellation retains lease on unconfirmed teardown. tests/unit/supabaseCandidateCoreRuntime.test.ts adds safety regressions, local signed browser adds create/offline complete/restart/tombstone and wrong-owner denial.
- **2026-10-19 reviewed repair authored for next task SHA:** fix category checkpoint browser fixture when task stream starts in parallel (track category cursors independently), use a valid no-body HTTP 204 synthetic logout, distinguish confirmed 401/403 refresh revocation (clear local trust) from transient network outage (do not mislabel confirmed logout), and add denial / success unit checks. docs/README.md core/provider navigation table literal '\\n' repaired; CORE_MVP_PROVIDER_RETURN.md updated. This repair is NOT accepted until focused AND signed lab run. The original d7 tests never executed.
- Critically, neither pilot imports into shipped AuthProvider / src/db/sync.ts. The real exclusive backend lease, stable Appwrite→Supabase identity mapping, old installed PWA write cutoff and reverse delta transfer are NOT implemented; do not bypass these with no-op guards or activate for users.

## Verification blocker and next action
- On repaired branch commit, request focused gate plus the dedicated disposable signed Chromium Auth/RxDB lab and review all exact-job failures. Do not squash into stable Preview or claim trusted READY while runner queue is stuck.
- Once green, create new isolated stable Preview, squash verified combined Auth+core source, run full canonical first-attempt acceptance and trusted prebuilt. Do not loosen CI provenance to work around queue.
- Then implement actual provider-specific Mosaic AuthProvider/session persistence with offline distinction; enforce cross-tab/old-PWA fence and true single writer, connect core tasks/categories RxDB to app startup, disable remaining unsupported background social tasks, signed hosted two-user tests, lossless forward+reverse Appwrite export/import+DR, real Android/iOS/browser acceptance before separately approved release. Diary #1029 follows immediately after working core.
