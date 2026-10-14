# Session checkpoint

Updated: 2026-10-14
Current task: #592 — first protected prebuilt Preview canary after CI-red safety check.

## Verified
- Protected main `67b444ae421bd51c5a0b5869f123bf7124a8d1c3`: full Quality Gate #38519174176 SUCCESS, Vercel Production READY at v0.17.4, ruleset active with zero bypass actors; `dev@f3d9558f` unchanged.
- Two consecutive stable canary commits `ec2adab` and `bb07752` passed full canonical and created ZERO provider deployments. Both read-only main receivers passed and writer jobs skipped before owner set the creation flag.
- [PR #819](https://github.com/carlers/mosaic-life-tracker/pull/819) tightened exact one-match branch-selector regression, stable `7df6dd4f15f6db3e0598935f4c70055789b0e47e`. [Full Quality Gate #38522051059](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522051059) FAILED only because the existing `AuthProviderPostHog` logout DOM test timed out waiting for user_1 after the default one-second wait under parallel workers. Build, unit and browser checks passed, but canonical acceptance appropriately FAILED.
- Verified exact Vercel project history for SHA `7df6dd4`: ZERO Git / CLI deployments. This is first actual CI-red zero-provider-create evidence under the corrected branch policy. Trusted provider writer correctly cannot run on red canonical.
- Owner says one-time GitHub Actions repository variable `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED=true` has been set. That has not yet been proved by a green post-enable trusted writer run. Keep alias OFF.

## Current fix
- Stabilize the existing logout identity DOM wait to 5s for parallel CI scheduling only; keep its exact identity assertion and logout PostHog reset behavior unchanged. No app code/size/routing/provider config change.
- Single new stable canary push after focused checks; verify canonical, then the read-only and protected writer jobs. Require exactly one accepted prebuilt Preview, strict SHA + Scratch/GIPHY/PostHog + routing, no Git builds or aliases; if skipped/failure inspect before any repeat.

## Next action
- Focused task CI → squash stable → canonical full gate. Inspect CI artifact attempt and Vercel project deployment history; do not retry failed provider upload blindly.
- After real prebuilt READY, verify device/browser contract and safe idempotency/stale/rollback, expand other stable categories and one ordinary feature→dev promotion. #592 OPEN until normal preview flow accepted.
