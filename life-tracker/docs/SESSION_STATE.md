# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 Supabase core-only Auth + two-domain RxDB pilot CI repair; source-only and not activated for users.

## Protected boundary
- Accepted capability-only isolated Preview: `refactor/1027-core-capability-reversible-20261019@1b09dee3ba3c2251bd5fb784a931541a0ee5cf85`; canonical #39239546559 SUCCESS and trusted #39239808796 READY. It does not ship a Supabase-backed app.
- Active experimental task branch: `chatgpt/1027-core-two-domain-20261019`, combining Auth and task/category RxDB source pilots. Shipped Mosaic still uses Appwrite for all eight domains; these pilots are not wired to `src/hooks/AuthProvider.tsx` or `src/db/sync.ts`.
- No Supabase hosted SQL/Auth/data, user data import, Appwrite or OCI writes, Vercel provider/environment switch, `dev`/`main`/Production promotion or release authorized by this checkpoint. One-writer isolation and verified symmetric Appwrite return remain mandatory; Diary #1029 immediately follows a working core release.

## Implemented
- `supabase-poc/candidateAuthSession.ts`: experimental in-memory signed GoTrue login/signup/refresh/logout/recovery and session-epoch fencing, including confirmed 401/403 refresh invalidation. No persistent app Auth or legacy account migration.
- `supabase-poc/candidateCoreRuntime.ts`: isolated guarded dual task/category RxDB native replication requiring verified owner, injected legacy mapping, Appwrite writer fencing and exclusive Supabase lease. Failure cancellation retains the lease if either writer teardown is unconfirmed; preserve original startup error as cause when throwing a cleanup failure.
- Disposable signed browser acceptance exercises both domains including offline task completion, restart/replay, tombstones, foreign-owner denial and category conflicts; source unit tests cover lifecycle and denied Auth.
- This repair also restores the exact `## Next action` checkpoint heading demanded by repository contract tests. No app-facing provider switch or schema migration.

## Verification
- Auth task `46af120df5671e5d30ad7bcc1b31eee89de8e771`: focused #39279620091 SUCCESS; signed local Auth/RxDB lab #39279620505 SUCCESS.
- Combined initial `d7f70e98d1329ab0d60040939466319e558796f7`: signed #39280874242 SUCCESS, focused #39280874284 FAILED due to `candidateCoreRuntime.ts` missing preserved cause in error thrown while handling startup failure.
- Reviewed repair `e1e0ed640196afe42a4f2bf5acd3dd4258cf6b06`: signed lab #39282816268 SUCCESS; focused #39282816230 FAILED `documentationContracts.test.ts` because checkpoint lacked `Next action:` or `## Next action`.
- New repair commit requires fresh exact-SHA focused CI. Original signed-lab success is not proof of a new commit's canonical acceptance. Local npm/Playwright was not executed in this connected-chat environment. No new stable Preview, full canonical or trusted delivery yet.

## Next action
- Review focused results for this checkpoint/exception repair and the same-branch signed lab. If green, squash verified combined source into a NEW isolated stable `refactor/1027-core-two-domain-20261019` Preview through a PR. Verify full canonical Quality Gate and trusted Preview delivery for exact stable SHA; do not promote to `dev` or `main` without separate approval.
- Next implement real provider-aware AuthProvider persistence/session offline distinction and owner identity mapping, authenticated server writer/old-PWA fencing, app task/category bootstrap separation, complete disabled-feature side-effect audit, hosted signed-user security, independent reversible migration/DR and multi-device acceptance before any core rollout.
