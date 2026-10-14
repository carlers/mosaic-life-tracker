# Session checkpoint

Updated: 2026-10-14
Current task: #592 live CI-first Preview suppression and writer canary.

## Verified
- Owner merged [main infrastructure PR #816](https://github.com/carlers/mosaic-life-tracker/pull/816) at `67b444ae421bd51c5a0b5869f123bf7124a8d1c3`. Main full [Quality Gate #38519174176](https://github.com/carlers/mosaic-life-tracker/actions/runs/38519174176) SUCCESS; matching Vercel Production `dpl_BSU66VoGZZxx1JW4rPrWGzJudwvY` READY. App v0.17.4 unchanged. Ruleset #24880070 active, zero bypass actors.
- `dev@f3d9558f` v0.23.4 and its regular Git deployments are unchanged.
- [Canary PR #817](https://github.com/carlers/mosaic-life-tracker/pull/817) is merged at `fix/592-trusted-archive-20261014@ec2adab28d80a94d26e7367c17ce9cc6ffff3faa`. Its high-level Vercel rules include exact `fix/592-trusted-archive-20261014:false` and non-overlapping other-fix allowlist. [Full Quality Gate #38520128515](https://github.com/carlers/mosaic-life-tracker/actions/runs/38520128515) SUCCESS. Verified Vercel project deployments for this exact SHA: **ZERO Git or CLI deployments**. [Trusted Preview Delivery #38520299678](https://github.com/carlers/mosaic-life-tracker/actions/runs/38520299678) SUCCESS, writer job SKIPPED. This is first live suppression evidence.
- Previous broken attempt only excluded canary from a `fix/!` true rule; fallback `*:false` did not match its slash, so the branch defaulted to Git deployment ON. One CI-red push still received Git Preview. Root cause is reproduced with Node24 glob tests.

## Current task
- Add a durable end-to-end minimatch ruleset regression in the canary's own unit tests. This generates an ordinary follow-up stable push with the explicit disable already present. Require full canonical and exact provider history showing ZERO Git deployments again.
- Protected main-only provider prebuilt writer is present and credential-gated. Do not enable `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED` or alias yet. No direct changes to main/dev/Production here.

## Next action
- Focused task CI → squash to canary stable → canonical green and second exact-SHA zero-provider readback.
- Only after robust suppression: controlled one-shot authorized prebuilt writer using the accepted artifact, verify exactly one Preview READY, Scratch/GIPHY/PostHog, SPA routes/headers, no duplicate after replay/stale. Preserve rollback to `fix/*:true` if provider behavior changes. Then generalize stable branches and one feature→dev acceptance. #592 stays OPEN until CI-first Preview works normally.
