# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 — fresh CI-first Vercel uploader canary after trusted project-root staging repair.

## Verified
- Owner merged protected infra-only [PR #828](https://github.com/carlers/mosaic-life-tracker/pull/828) as main `40bb1cce69b8db924d5d4e2eb58203499f892113`; exact [main full Quality Gate #38538577172](https://github.com/carlers/mosaic-life-tracker/actions/runs/38538577172) SUCCESS, all browser/DOM/build/canonical; matching Vercel Production `dpl_DuAvMTSP2WHgXADF1sNf2hBfSDFi` READY. App v0.17.4 unchanged, main ruleset #24880070 ACTIVE with ZERO bypass actors, dev `f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Previous exact canary `fix/592-trusted-archive-20261014@003beb3acaf95fb68f717d04e293b95289600579` passed [full canonical #38535580930](https://github.com/carlers/mosaic-life-tracker/actions/runs/38535580930) and had ZERO project-scoped Vercel deployments. [Trusted Preview Delivery #38535815478](https://github.com/carlers/mosaic-life-tracker/actions/runs/38535815478) read-only receiver SUCCESS; protected writer FAILED before provider creation: pinned CLI checked nonexistent `<temp>/life-tracker` rootDirectory. Earlier `User not found (404)` issue was cleared by no --team/--scope flags. Do NOT rerun these failed jobs.
- PR #828 uses exclusive creation of an EMPTY `<temp>/life-tracker` stub while retaining exactly one vetted `<temp>/.vercel/output` and local verified .vercel/project.json; filesystem regression asserts output unchanged, non-production project/target guard and duplicate refusal. No app scripts or builds run in protected writer.

## This canary task
- Start from the quiet `fix/592-trusted-archive-20261014` stable canary, add test verifying a seemingly green canonical check cannot authorize forged workflow identity, repository, incomplete run, or malformed run attempt. No app change, Vercel config, code build outputs, provider settings, secrets, version, backend, alias or branch policy changes.

## Next action
- One focused task [verify:focused] → squash onto stable canary → exact full canonical and ZERO Git-created Vercel deployments while pending; run main-owned read-only receiver and protected `--prebuilt --target=preview` writer with exact-SHA/source provenance. Demand ONE resulting static READY Preview at same source SHA/project, Scratch/GIPHY/PostHog and routes/security-headers/deep-links parity, no build and alias OFF. On failure inspect exact CLI stderr and provider history BEFORE any new push/retry. Verify idempotency, stale/rollback, expand only after evidence, then approved real feature→dev. Issue #592 OPEN; no device/manual tests claimed.
