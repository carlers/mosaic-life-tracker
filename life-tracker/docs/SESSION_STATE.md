# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 trusted Preview — correct existing deployment retry readback without creating duplicate.

## Verified
- Owner-merged infra-only [PR #828](https://github.com/carlers/mosaic-life-tracker/pull/828) at protected `main@40bb1cce69b8db924d5d4e2eb58203499f892113` passed [main full Quality Gate #38538577172](https://github.com/carlers/mosaic-life-tracker/actions/runs/38538577172); matching Vercel Production `dpl_DuAvMTSP2WHgXADF1sNf2hBfSDFi` READY, app v0.17.4 unchanged. Main ruleset #24880070 active ZERO bypass; dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- New isolated canary [PR #829](https://github.com/carlers/mosaic-life-tracker/pull/829) focused #38539034095 SUCCESS and squash `fix/592-trusted-archive-20261014@61e6728935ef734eab448da291a12a485aabe7b3`; [full canonical #38539164866](https://github.com/carlers/mosaic-life-tracker/actions/runs/38539164866) SUCCESS. Zero Vercel Git builds for exact canary SHA.
- [Trusted Preview Delivery #38539354517](https://github.com/carlers/mosaic-life-tracker/actions/runs/38539354517) attempt 1 SUCCESS receiver + protected writer. Writer reports verified CI artifact, SHA/route/project, deterministic ID `mosc8693bf0eb5f0a61be493f3fdde81`, one `--prebuilt --target=preview` READY and no alias/script/app build. Vercel confirms `dpl_DtqNxRakFrBXCnrYy5xYSZ7QocnR` READY, `source=cli`, `target=null`, project correct, alias EMPTY. Hosted app `/`, deep route `/settings/notifications`, `/sw.js`, `/manifest.webmanifest` HTTP 200; security headers correct. Scratch/GIPHY/PostHog accepted and validated by protected verified CI artifact profile; no logged-in device test.
- A single authorized retry of the already-successful Trusted Delivery #38539354517 attempt 2 FAILED writer BEFORE POST with `Vercel deployment identity or target mismatch`; receiver again SUCCESS. Vercel deployment list confirms still exactly ONE new CLI READY deployment, no duplicate. Hence initial CI-first creation WORKS; idempotent reuse does NOT yet pass. Do NOT retry again before reviewed main fix.

## Narrow main-based correction
- Vercel /v6 list is compact; existing hard requirement that summary alone contain project/target/route is not safe for idempotent reuse. On matching SHA/deploymentId, fetch authenticated /v13 deployment detail by exact provider ID and verify summary/detail consistency, project, SHA, route, preview target and state BEFORE safely deciding reuse/wait. The same /v13 detail endpoint worked for successful first-create READY readback. Keep exhaustive bounded paginated history, duplicate/unknown-state blocks and no-POST fail closed.
- Add focused pure regression: incomplete list with correct candidate ID rejected alone, complete details permit reuse or wait, contradictory IDs/targets/projects/route/status rejected. No app/version/build budget, Vercel account/branch/project, credentials, backend, Production/dev, alias or repo protection changes.

## Next action
- Focused task → main-based stable full canonical+Preview READY → protected main PR, fresh specific OWNER PR-only temporary exception, merge commit, zero-bypass restore, main canonical/Production READY. Do not retry until main fix proven.
- Then rerun same already accepted canary writer ONCE for successful `Verified prebuilt already present: reuse` with zero new Vercel deployments, rather than pushing a new canary. Finish stale/rollback and controlled general stable rollout, later approved real feature→dev. Issue #592 OPEN; manual phone/browser authentication not claimed.
