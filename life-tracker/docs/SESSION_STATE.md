# Session checkpoint

Updated: 2026-10-14
Task: #592 CI-first Preview delivery — failed Git suppression rollback.

## Verified
- Protected `main@0c0152807c450071f5adfabca67d9344ccf0aa77` has [Quality Gate #38513209910](https://github.com/carlers/mosaic-life-tracker/actions/runs/38513209910) SUCCESS, Production `dpl_Ekti2CTDKwANp4Cm1JKETq3rP47W` READY at unchanged app v0.17.4. Ruleset #24880070 active, zero bypass actors. Owner merged infrastructure-only PR #812.
- `dev@f3d9558f` app v0.23.4 unchanged. #784 separate.
- Read-only default-main [Trusted Preview Delivery #38506275297](https://github.com/carlers/mosaic-life-tracker/actions/runs/38506275297) SUCCESS: accepted canonical SHA and all 161 archived files, Scratch profile, v3 routes, no provider write.
- Protected default-OFF prebuilt writer exists on main. `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED` and alias switch must remain OFF.

## Two live Git-cutover failures
- [PR #811](https://github.com/carlers/mosaic-life-tracker/pull/811) replaced `fix/*: true` with `fix/!(592-trusted-archive-20261014): true` to suppress only the canary while retaining main/dev and other branches. **Vercel still created a Git Preview** `dpl_A6VWreeEbqygVG8mbcXVjHEbXYhF` for the first push SHA `ead67286`.
- On second, docs-only [PR #813](https://github.com/carlers/mosaic-life-tracker/pull/813), Vercel **again** created Git Preview `dpl_2N1MModAB1MuePvw4VXmJriezxMi` READY, even though [Quality Gate #38513638626](https://github.com/carlers/mosaic-life-tracker/actions/runs/38513638626) FAILED its pinned `vercel.json` routing fingerprint tests. This directly reproduces provider waste on CI-red.
- This rollback restores the original `fix/*: true` Git rule and original pinned config. A second, independent suppression mechanism MUST be proven before enabling the writer. Exact Vercel matcher or Git webhook config scope is not yet explained. Do not guess or silently disable global Preview/dev auto deployments.

## Next
- Verify rollback focused + full Quality Gate, inspect Vercel READY and record issue evidence.
- Investigate provider-side Git trigger settings and config scope without repeated speculative builds. A project-wide Preview deployment-source restriction may also affect `dev` and ordinary Previews; no provider config mutation without explicit reviewed rollout/rollback.
- Then demonstrate CI-red=0 provider creates, CI-green=one trusted prebuilt, replay/stale=zero, correct app/route/auth; finish issue #592. Do not merge to dev/main or turn on aliases.
