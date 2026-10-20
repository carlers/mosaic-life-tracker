# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 isolated refresh-token persistence and signed Supabase Auth restore, following core-only Appwrite background isolation.

## Accepted baseline and boundaries
- Latest accepted isolated Preview: `refactor/1027-core-auth-side-effects-20261020@4ae1db7a249cc762680087ceaaa202f8f0874c6b`, PR #1064, full canonical #39368651838 SUCCESS, signed local Supabase Auth/RxDB #39368651878 SUCCESS, trusted Preview #39368842566 SUCCESS (Vercel READY).
- Shipped `dev`/`main` remain independent Appwrite; Supabase task/category prototype, in-memory Auth and core-only AuthProvider side-effect suppression are source-only. No hosted Supabase Auth/SQL/data migration, existing-user import, OCI/Appwrite, Production, protected branch promotion or core-only provider switch authorized. Preserve reversible transfer to Appwrite and immutable old PWA writer fences. Diary #1029 follows immediately after a working released core MVP.

## Working change
- Task branch `chatgpt/1027-persisted-auth-refresh-20261020` based on exact stable `4ae1db7a249cc762680087ceaaa202f8f0874c6b`.
- `supabase-poc/candidateAuthSession.ts`: opt-in injection of a provider-origin-bound refresh-token store; explicit restoration via real refresh and signed /user with owner and session epoch checks; no offline authentication derived from storage. Confirmed 401/403 and invalid owner erase stored token; temporary network failure retains token but grants no identity; rotation save is required before adopting new JWT; signout/account switch remove saved credential.
- `tests/unit/supabaseCandidateAuthPersistence.test.ts`: seven adversarial/functional persistence, rotation, crash/offline, wrong-owner, stale-response, logout, failed-write cases.
- `docs/CORE_MVP_PROVIDER_RETURN.md`: states storage is disabled by default, and multi-tab token rotation/exclusive lease and app integration remain blocking; no production Vercel change or feature/version increase.

## Verification
- Task commit requests focused CI; local npm/Playwright not available from this GitHub-connected chat environment. No test result is claimed for this new tree yet.
- Current hosted `mosaic-dev` 4 synthetic/empty owner-RLS tables and 2 externally callable SECURITY DEFINER RPC warnings remain unremediated pending signed hosted/independent security review. Do not activate provider remotely.

## Next action
- Inspect exact task focused CI and repair failures; then squash into NEW isolated stable Preview only after focused green, require full canonical success plus signed lab and trusted prebuilt READY at exact stable commit.
- Continue with actual Supabase app AuthProvider+offline cache and signed legacy ID mapping, tab/browser refresh-token ownership fencing, server enforcement against old Appwrite/PWA writers, task/category app RxDB bootstrap, hosted two-owner security tests, tested bidirectional Appwrite data migration and DR restore, and Android/Safari offline acceptance. Keep #967/#1027/#975 open.
