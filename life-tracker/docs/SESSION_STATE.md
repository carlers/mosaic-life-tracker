# Session checkpoint

Updated: 2026-10-13 UTC
Current task: #592 trusted Preview reuse-only shadow runtime adapter.

## Verified live
- Owner merged narrow infrastructure-only PR #779: current `main@0e39e7315e18e6750843780432dd42d22f940367`, unchanged app v0.17.4, `dev@d7656e2513e5ee9d339814890cd7f707f18461d6`. Full main Quality Gate #38329110108 SUCCESS; exact main Vercel Git Production `dpl_6id9FN1ATTmgxANnjD5oHTRwC7JR` READY and original production aliases unchanged; ruleset #24880070 ACTIVE, zero bypass actors. Earlier quota error was transient and is no longer an open deployment blocker.
- Owner's GitHub environment/repo flags are live. Existing approved pilot Quality Gate #38318701965 re-run attempt 3 SUCCESS. Its trusted default-branch receiver #38329261073 ran with shadow=true/create=false/alias=false but failed closed; bounded diagnostics: `pages=1 listed=18 sameSha=1 exactRef=1 absentTarget=1`. The Vercel project already has exact-SHA official Git READY Preview `dpl_CjsoQ5CoU4At7iRWDqPfC3DmxAYX`, target null. No new deployments or aliases were written.
- Verified published Vercel SDK response contract for GET /v6/deployments has **required uid** and optional target; connected provider client normalizes `uid` to `id`. Selector incorrectly required `dep.id` at list stage, explaining the live mismatch. The detailed authenticated GET continues enforcing official project/branch/SHA/source/Preview target/READY.

## Scoped resolution
- Accept either Vercel raw LIST `uid` or normalized `id` only if a valid `dpl_` identity, rejecting contradictory dual fields; retain full authenticated deployment GET as final safety gate.
- Add raw-provider-shaped regression test with missing target, READY preference and mismatched IDs; do not loosen CI/source checks, authenticated GET, default-OFF creation or alias flags.
- No app runtime, version, Vercel provider settings, Appwrite, main/dev or production alterations in this task.

## Next action
- Focused task CI, squash to isolated stable Preview, full canonical + Vercel Preview READY. Obtain separately authorized main-only infra merge for this correction (normal `dev→main` would ship unrelated app work). Then rerun already-approved pilot and verify live readback READY, zero POST/alias, same-SHA idempotency. #592 stays OPEN for provider shadow negatives, hosted creation/alias strategy, branch generalization and five-promotion evaluation.
