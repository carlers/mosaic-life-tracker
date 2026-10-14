# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 trusted Preview — Vercel /v6 history `uid` field correction.

## Verified
- Owner merged protected [PR #831](https://github.com/carlers/mosaic-life-tracker/pull/831) to `main@84964acee52110d4ab5b34b4da790a01e168e036`. [Main Quality Gate #38541675652](https://github.com/carlers/mosaic-life-tracker/actions/runs/38541675652) full SUCCESS, Production Vercel `dpl_3Nphv8tds4L3JEVazX3WvvfAc3qW` READY at unchanged app v0.17.4. Main ruleset #24880070 active ZERO bypass; dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Exact canary `fix/592-trusted-archive-20261014@61e6728935ef734eab448da291a12a485aabe7b3` [Quality Gate #38539164866](https://github.com/carlers/mosaic-life-tracker/actions/runs/38539164866) SUCCESS. First default-main Trusted Preview Delivery #38539354517 attempt 1 SUCCESS created exactly ONE static CI-first Vercel Preview `dpl_DtqNxRakFrBXCnrYy5xYSZ7QocnR` READY, `source=cli`, Preview `target=null`, ZERO aliases; no Git build for exact SHA, app version/backends unchanged. Hosted root, `/settings/notifications`, service worker, web manifest and security headers HTTP 200. Source CI ZIP verifies Scratch/GIPHY/PostHog.
- First original Trust Delivery rerun #38539354517 attempt 2 FAILED before provider POST (`Vercel deployment identity or target mismatch`). Following owner-merged #831, we safely reran ONLY source canary's nonprivileged CI build job (same SHA, Quality Gate #38539164866 attempt 2 SUCCESS with fresh exact-attempt 814607-byte artifact). This generated new default-main [Trusted Delivery #38542360005](https://github.com/carlers/mosaic-life-tracker/actions/runs/38542360005) pinned to current main `84964ace`: receiver SUCCESS, writer FAIL before provider POST `Invalid matching provider deployment ID`. Provider deployment list still contains ONLY original CLI READY. No duplicate, no alias.
- Root cause now verified in [Vercel SDK /v6 deployments schema](https://github.com/vercel/sdk/blob/main/docs/models/deployments.md): list deployment identifier is `uid`, whereas current history enrichment requires `summary.id`. Existing tests modeled `id` only. Main code does NOT yet support the real schema.

## Narrow approved main-based correction
- Normalize `uid` from v6 and `id` from v13 to one exact valid `dpl_` identity; reject absent/malformed or contradictory `id` and `uid`. Verify detail matches list ID, URL, project, source SHA, branch, routing fingerprint, non-production target and state before reuse/wait. Test Vercel real v6/v13 fixture and adversarial mismatches. Preserve bounded exhaustive history and zero-POST on unknowns.
- No app/version/build budgets, Vercel config/env, token, CI workflow/protection, alias, backend, Production or dev changes.

## Next action
- Focused task → main-based stable Preview full canonical+Vercel READY → narrow protected-main PR requiring new owner-approved temporary PR-only ruleset exception, merge commit and immediate zero-bypass restoration. Verify new main Quality Gate/Production.
- Repeat the previously proven same-SHA *source build* rerun after main is updated, NOT the old trusted writer job (GitHub reruns pin original main SHA). Demand new default-main trusted delivery reports `Verified prebuilt already present: reuse`, and still precisely one provider CLI deployment; no new canary push or alias. Complete stale/rollback tests and wider stable delivery rollout. Issue #592 OPEN; manual/device login unverified.
