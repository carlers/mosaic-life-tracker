# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 — normal-development six-member CI Preview artifact producer, isolated stable rollout.

## Verified before staging
- Protected main `a7d4c431eef6902f1d2d35271b6b8e41f8e9228e`: full Quality Gate #38569807748 SUCCESS, Production Vercel READY v0.17.4; ruleset has zero bypass actors. Dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Third ordinary generic feature `25d6d0a5a7686886043cd1a995701b5f4ff42c32`: canonical #38570924020 SUCCESS, one static CLI Preview READY, same-SHA retry reused without POST. Generic rollout now OFF: subsequent trusted delivery #38575847861 skipped both jobs, preserved READY Preview. Issue checkpoint: https://github.com/carlers/mosaic-life-tracker/issues/592#issuecomment-6170060463.
- Quiet task `chatgpt/592-dev-ci-producer-20261014@4d9c3c80bacb833f10b21686202ceaca6b5e51f8` full Quality Gate #38577395653 SUCCESS, zero provider deployment.

## Scope and checks
- Dev-derived stable `fix/592-dev-ci-producer-rollout-20261014` stages the reviewed six-member static CI producer, Scratch/public profile and routing/header verification, pinned routing library, tests and notification fixture clock repair.
- Preserve original dev `vercel.json` Git-auto rules, app runtime/v0.17.4/backend/budgets and exact reviewed Quality Gate blob `5f64f715551f0c311a60d823367d849dfb369bba`. Quiet `chatgpt|codex` branches may create only `deploymentAuthorized:false` diagnostic evidence; protected main still rejects them from provider delivery.
- First stable `ed2d3ebdea3b992cf6912eccfe4c63702a6aeefe` Vercel Git Preview `dpl_EuMBpVuGp6skpoGjYUfT3VMRtKag` READY. CI #38578016946 failed only because this checkpoint inflated the 3000-token fixed handoff budget (3046). App build, dependencies, DOM/browser and hosted route/header checks passed. Fix by shortening this checkpoint, never relaxing the budget.

## Next action
- Obtain focused doc-contract success, squash to stable, then require new exact stable full canonical CI and matching Vercel READY. Inspect promotion preflight and get explicit user authorization before PR/merge to `dev`. No app/Production/provider setting or alias mutation; generic switch remains OFF. Manual Scratch login and phone acceptance separately pending. Issue #592 OPEN.
