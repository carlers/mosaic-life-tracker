# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 autonomous local signed Supabase Auth, RLS and CAS integration; isolated research only.

## Boundary
- Based on isolated accepted `refactor/967-create-master-transport-20261019@90d4964c3b454696556758f558a0461432f0df76`: canonical #39185591566 SUCCESS, trusted prebuilt Preview #39185753239 SUCCESS.
- Task branch `chatgpt/967-local-signed-auth-ci-20261019` contains only source-only Supabase POC, isolated GitHub workflow, regression tests and docs. No shipped Mosaic Appwrite runtime, dev/main/Production, cloud schema/auth policies, provider migration or real user data changed.
- Prior hosted Edge Function credential attempt failed admin validation and was disabled at version 5, yielding HTTP 410. Read-only hosted Auth settings show anonymous sign-ins disabled and email confirmation required; no bypass or hosted Auth configuration change. Last hosted database counts were 0 Auth users and 0 candidate task/category rows.
- Hosted Supabase SECURITY DEFINER task/category RPC warnings remain unresolved. No proven hosted signed-user HTTP results.

## Work and executed evidence
- New `supabase-poc/signed-local-smoke.mjs` hard-locks to local Supabase CLI port 54321. Dedicated `.github/workflows/supabase-local-signed-auth.yml` creates ephemeral local Auth/REST/Postgres, applies checked-in candidate SQL, registers two synthetic password users with local-only confirmation disabled, verifies real Auth signed tokens, exercises positive and negative owner RLS, denied direct/anonymous writes, duplicate create, true concurrent CAS, stale/foreign conflicts, blocked patch injection, tombstone and revision cursor replay. CLI stack is destroyed in always() cleanup.
- Initial signed integration #39191871670 failed a strict CAS response assertion, then diagnostic #39192192165 showed one winner `owned-composite` and one loser `null-composite`. Rollback-only hosted SQL independently reproduced SQL typed-null row JSON with null columns. This is **not** an unsafe double-winner race. Candidate client now recognizes only complete typed-null composite as explicit conflict and rejects malformed/mixed replies.
- **Signed integration run [#39192402019](https://github.com/carlers/mosaic-life-tracker/actions/runs/39192402019) SUCCESS** at source `162032df166405d44be4746c00a9e2202d40166c`: 2 server-verified user sessions, 4 own + 4 foreign reads, denied spoofed owner insert, 2 denied direct writes, 2 anon denials, 4 inserted fixture rows, 1 duplicate conflict, 1 successful concurrent CAS with stale loser, 1 stale conflict, 1 foreign CAS conflict, 1 rejected injection, 1 logical tombstone and cursor read. Local stack cleanup executed successfully.
- Added unit regressions for SQL typed-null CAS conflict vs malformed partial composites. Tightened unshipped CAS transport to require modern `sb_publishable_` key rather than allowing possible legacy JWT-formatted service role. No user-visible change/version bump.

## Verification
- Signed local integration SUCCESS at source 162032df; later source additions (CAS public-key hardening and docs) require final task [verify:focused] and local CI evidence, then separate stable Preview canonical/trusted delivery. Do not treat earlier local smoke as proof of the final exact SHA until verified.
- Hosted `mosaic-dev` real signed Auth proof is still pending an authorized test-user channel. This local stack is intentionally not hosted and does not prove long-running real-device RxDB persistence.

## Next action
- Run final focused task CI and local signed integration, repair any failures. Squash coherent task into fresh isolated stable Preview branch, require canonical full Quality Gate and trusted CI-first Preview READY, post issue #967 exact-SHA checkpoint. Keep #967 OPEN.
- Next POC milestone: RxDB native persisted checkpoint/push integration, retries and multi-device tests. Hosted signed-RLS security and two SECURITY DEFINER findings must be accepted separately before cutover. No dev/main promotion, Production changes or 1.0 release without explicit separate approval.
