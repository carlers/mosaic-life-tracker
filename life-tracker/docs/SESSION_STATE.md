# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 — third generic CI-first Preview rollout pilot, initially gated OFF.

## Verified starting point
- Owner merged protected main [PR #844](https://github.com/carlers/mosaic-life-tracker/pull/844) as `a7d4c431eef6902f1d2d35271b6b8e41f8e9228e`; full Quality Gate #38569807748 SUCCESS, Vercel Production `dpl_CNVEygWZfQzHc45vzTopdNrx3CPL` READY, app v0.17.4. Ruleset #24880070 active with zero bypass actors, dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Original two exact-name pilots proved full CI-first static deployment and same-SHA zero-POST reuse. Generic receiver now requires the separate `MOSAIC_TRUSTED_PREVIEW_GENERIC_ENABLED` switch, exact source policy and verified six-file Quality Gate blob `5f64f715551f0c311a60d823367d849dfb369bba`.
- Generic rollout is NOT authorized merely by merging #844. Do not enable repository variables or provider creation until owner explicitly approves.

## Current isolated source
- Candidate stable ref: `feature/592-generic-optin-trial-20261014`, dev-derived.
- FIRST stable commit must contain exact `feature/!(592-generic-optin-trial-20261014): true` plus `feature/592-generic-optin-trial-20261014: false` in `life-tracker/vercel.json` BEFORE branch creation. Keep other Git policies, app runtime/version, Scratch/GIPHY/PostHog, routes and headers untouched.
- Start from the previously accepted second dev-derived pilot's static six-file producer + pinned Quality Gate, identical source artifact scripts and test-clock correction; only new exact branch policy, matching workflowDocs test and this documentation change. Parent of stable commit is dev.
- Quiet task focused CI first; then atomically create stable ref at prepared commit already containing the suppression, run full canonical CI and confirm ZERO early Git-source provider deployments. Until generic flag is explicitly enabled, do not expect trusted main's receiver/writer to deploy this ordinary branch.

## Next action
- Verify policy and source SHA/CI. Once authorized, enable generic switch separately and trigger an exact-SHA source Quality Gate event without changing the branch tree; confirm default-main receiver + writer one CLI static READY, aliases OFF, no Git auto, same-SHA retry reuses without another POST, and hosted routes/headers. Validate rollback by switching generic OFF before any provider setting change. Registered Scratch-origin login/device and a genuine Preview→dev promotion require separate explicit acceptance. Keep #592 OPEN.
