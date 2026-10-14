# Session checkpoint

Updated: 2026-10-14
Current task: #592 — correct prebuilt Vercel CLI team flag after live failed-first-upload.

## Verified project safety
- Protected `main@67b444ae421bd51c5a0b5869f123bf7124a8d1c3` app v0.17.4; full Quality Gate #38519174176 SUCCESS and Vercel Production READY; ruleset #24880070 active, bypass actors ZERO. `dev@f3d9558f` v0.23.4 unchanged.
- Explicit canary `fix/592-trusted-archive-20261014:false` and disjoint other-fix allowlist work: two independent green pushes created ZERO Vercel Git Previews. Subsequent red full canonical [#38522051059](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522051059) also created ZERO deployments and protected writer did not run.
- Test-only auth/PostHog flaky async wait repair [#820](https://github.com/carlers/mosaic-life-tracker/pull/820) led to green full canonical [#38522610668](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522610668) on stable `bf56a5f84bf985370c34368f1ce0d2161d2925ec`. [Trusted Preview Delivery #38522774415](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522774415) trusted verifier SUCCESS; provider writer STARTED, proving owner set create variable true and alias remains false.
- Provider CLI v62.7.0 FAILED before any deployment with `User not found (404)` because its argv used `--scope team_U...`; Vercel docs specify slug for --scope, ID for --team. Authenticated project+history readbacks already succeeded; provider history for accepted SHA remains ZERO. Do NOT rerun old code or cause a second provider attempt.

## Active infrastructure-only change
- Main-based task replaces CLI `--scope` with `--team` when passing the pinned team ID. Regression rejects --scope for ID and requires exact --team once. Existing Preview-only target, deterministic deployment ID, full SHA/ZIP/source/route attestation and alias OFF are preserved.
- No application, env, secret, provider config, branch match, size guard, dev/main/Production release changes in task stage.

## Next action
- Focused CI then stable main-based full canonical + Vercel Preview; prepare infrastructure-only PR to protected main requiring owner-specific temporary Pull-requests-only bypass. Restore zero bypass immediately; verify main full CI/Production v0.17.4.
- Then only ONE fresh eligible canary accepted SHA, no Git-created Preview, protected writer one prebuilt READY, exact Scratch/GIPHY/PostHog/SPA/headers; inspect provider history before retry if it fails. Alias OFF. Complete idempotency/stale checks and gradual stable-branch rollout, one ordinary feature→dev; #592 OPEN.
