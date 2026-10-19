# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #1027 signed local Supabase Auth session lifecycle for expedited core-only owner-private sync.

## Verified baseline
- Accepted isolated Preview refactor/1027-core-capability-reversible-20261019@1b09dee3ba3c2251bd5fb784a931541a0ee5cf85, PRs #1028/#1030, canonical #39239546559 SUCCESS, trusted prebuilt READY #39239808796.
- Protected dev@a9c5192a6aa6cea9d16ef8d1dca60e6d108756c1 and main@b952f71ecd2add3172f90104bc0e856a2648ccc9 unchanged at task start. #1027 core-only MVP, #1029 Diary first after core, #967 Supabase, #975 OCI Appwrite return remain OPEN.
- No Production, hosted Supabase schema/Auth/users/data, Appwrite/OCI VM, environment provider swap, dev/main promotion or 1.0 release approved. Appwrite full runtime remains default.

## Scoped work
- supabase-poc/candidateAuthSession.ts: isolated source-only in-memory Supabase password, refresh token, logout, signup/recovery adapter. Server-verify each login/refresh owner via Supabase Auth GET /auth/v1/user, fence account switch and token epoch, fail closed on stale responses, retain no tokens in localStorage. Compose with existing signed owner-locked candidate Auth/REST/CAS.
- tests/unit/supabaseCandidateAuthSession.test.ts: synthetic session lifecycle, two users, stale concurrent login, refresh owner rejection/singleflight, deny foreign REST reads, failed remote signout local fencing, confirmation and recovery guard.
- tests/e2e/supabase-signed-rxdb.ts + .spec.mjs: fourth dedicated disposable local real signed Chromium JWT case for password login, rotation, owner switch, wrong-principal denial and logout. Keep existing category RxDB offline/restore/conflict and two-domain signed contract tests untouched.
- Scoped signed lab workflow recognizes task/stable auth branches. docs/CORE_MVP_PROVIDER_RETURN.md records exact source-only boundaries and remaining auth continuity.
- No actual shipped Mosaic AuthProvider or production writer integrated. Browser session is in-memory and requires login again on reload; existing Appwrite account identity/password migration and offline cached UX remain open. Do not describe this as a usable Supabase MVP yet.

## Verification
- At checkpoint creation focused CI, genuine disposable signed browser and stable canonical/trusted Preview are pending; use exact Actions evidence on finished SHA, not previous proof.

## Next action
- Commit coherent task chatgpt/1027-core-auth-lifecycle-20261019 [verify:focused], run local signed lab (genuine Supabase GoTrue JWT + browser), repair failures. Squash only after both green into new isolated stable refactor/1027-core-auth-lifecycle-20261019 and require full canonical gate plus trusted prebuilt READY. Post exact checkpoint to #1027 and #967.
- Follow next with provider-exclusive two-domain RxDB runtime bootstrap and Supabase Auth replacement plus account mapping, restart-safe refresh, offline session grace, full social-side-effect suppression and true Appwrite↔Supabase reverse import. Diary #1029 immediately after approved core release, never as a social dependency. No protected promotion/provider selection or Production release without separate approvals.
