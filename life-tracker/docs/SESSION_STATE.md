# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 signed disposable Chromium/GoTrue reload proof for opt-in candidate refresh persistence.

## Baseline and authorization
- Isolated experimental stable Preview `refactor/1027-persisted-auth-refresh-20261020@e23b73e5117316779d3fa5afa63e8e60f5dfcf1a` through PR #1065; task focused #39369874814 and stable full canonical #39370049668 SUCCESS, trusted delivery #39370218374 SUCCESS and Vercel exact prebuilt READY. No signed local Auth lab ran for the persistence-only branch, so this follow-on specifically tests real signed credentials.
- Current branch: `chatgpt/1027-core-auth-persist-signed-20261020` based on `e23b73e5117316779d3fa5afa63e8e60f5dfcf1a`. Source-only synthetic browser tests; shipped Mosaic AuthProvider and eight-domain Appwrite backend unchanged; no production/dev/main/provider promotion, hosted Supabase schema/Auth/data, OCI or existing-user migration. Preserve independent DR, symmetric Appwrite return and old-PWA/one-cloud-writer protection.

## Current change
- `tests/e2e/supabase-signed-rxdb.ts`: add disposable local-only `exerciseSignedPersistedAuth` fixture with injected browser sessionStorage. Require no implicit session before signed verification; login persists origin-bound refresh credential only; reload must exchange and verify actual signed UUID; token rotates; logout must erase stored credential; subsequent reload returns no identity.
- `tests/e2e/supabase-signed-rxdb.spec.mjs`: browser test drives login -> page reload -> signed restore -> page reload -> signed restore/logout -> page reload -> no credential. Uses synthetic isolated user, real local Auth/PostgREST and no CI secrets; no changes to canonical browser correctness tests.
- `docs/CORE_MVP_PROVIDER_RETURN.md`: document genuine local signed acceptance boundary and remaining unsafe multi-tab token single-use races, no real app session yet. Existing unit suite covers malformed and denied state.

## Verification
- Current task commit requests focused CI, and branch matches dedicated `Supabase Signed RxDB Browser Lab` workflow. Need exact-SHA focused and signed lab PASS before stable squash; then fresh full canonical and trusted READY.
- No hosted Supabase writes or signed acceptance claimed for this new test until exact run succeeds. Local npm unavailable in current GitHub-connected environment.

## Next action
- Review exact task focused and dedicated signed Chromium/GoTrue labs; diagnose/repair real token response or browser reload assertions before stable Preview promotion. After green, squash via PR to isolated `refactor/1027-core-auth-persist-signed-20261020` and require full canonical/signed/trusted green.
- Next implement actual provider-aware Mosaic Supabase login/session storage, verified legacy Appwrite owner IDs, server-enforced old-PWA and single writer gates, two-domain app sync bootstrap, hosted signed RLS/CAS security review, bidirectional DR/export/replay, offline device acceptance. Diary #1029 immediately after core works. Keep #1027/#967/#975 open.
