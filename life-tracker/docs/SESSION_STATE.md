# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 — generic opt-in CI-first Preview admission proposal, protected-main security boundary.

## Verified live before this change
- Owner merged infrastructure-only PR #837: protected `main@2a6210d940c0387e88a617684ba4e24a21b7e1ad`; full main Quality Gate #38558325570 SUCCESS, Production Vercel `dpl_5gja3K4uWzYC8pquT2tfVQzgoDqU` READY v0.17.4, zero main bypass actors. `dev@f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Two isolated CI-first pilots succeeded. Second exact `feature/592-prebuilt-pilot-20261014@d5c26e5e9eeaab87a21d3af262dd4446c9c11337` full Quality Gate #38561627651 attempts 1 and 2 SUCCESS; trusted main receiver/writer #38561903504 created exactly one static CLI Preview `dpl_95RhNayCZnMzu6d9WcSRiCrtPXjb` READY, zero Git-auto deployments or aliases; #38562308108 reused without provider POST. Authenticated hosted HTTP root, login, notifications, settings/messages deep links, SW and manifest 200; unconfigured path 404; required security headers correct. Not a logged-in device check.
- Latest issue checkpoint: https://github.com/carlers/mosaic-life-tracker/issues/592#issuecomment-6168172545.

## This candidate's scope
- Main-owned, fail-closed **default-OFF** generic opt-in for precisely one branch at a time, single-leaf `feature|fix|perf|security|refactor` category. Separate repository switch `MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED`; the existing provider-create flag is still independently required, aliases remain OFF.
- Require the branch's first commit to carry the exact main-reviewed, nonoverlapping own-category Git rule: complementary negative glob plus exact `false`, all other categories/main/dev unchanged. Read-only receiver checks source Git bytes at the accepted SHA before reading protected CI artifact; normal Git-auto branches skip. Credentialed writer requires explicit read-only `admitted=true` output and independently repeats source policy, exact CI/head, Scratch/public profile/route/artifact/provider history checks.
- Preserve existing named pilots, main/dev/prod/version/backend/budgets, all other Vercel Git Preview branch behavior. Do not activate generic switch, alias or provider settings as part of staging.

## Next action
- First stable full Quality Gate #38565675231 failed THREE stale test-only assertions: two old fixed-branch expectations and one nested-invalid source ref mismatch. Build, dependency, both DOM shards and Vercel Git Preview were READY/passing. Batch the three assertions in one focused task repair, then require a fresh full stable canonical gate. The generic switch remains OFF and main/dev unchanged.
- Task branch must pass focused checks with new generic admission, skip, category cutover, red/stale/forged/unsafe, wrong-target/reuse regressions. After focused-green, squash to isolated main-based fix Preview for full canonical CI and Vercel READY. Review changed main workflow security boundary and open protected-main PR only after acceptance. Main merge needs **fresh owner-only temporary Pull-requests-only protection exception**, then immediately restore zero bypass, confirm main full CI + Production READY. No automatic main merge or prior approval reuse.
- **Later rollout:** separate explicit owner authorization to enable generic switch; first normal stable single-leaf feature branch pilot (zero premature Git Preview), same-SHA retry/rollback, independently approved feature Preview→dev, Scratch origin/device/login. Keep issue #592 OPEN until acceptance. Do not do backend writes, aliases, version bumps, app UI changes or Production promotion.
