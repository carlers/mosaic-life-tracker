# Session checkpoint

Updated: 2026-10-14 UTC
Current task: #592 trusted CI-first Preview writer — first successful provider canary.

## Verified
- Owner merged protected main infrastructure-only [PR #822](https://github.com/carlers/mosaic-life-tracker/pull/822) using merge commit `70104058ba71cd5f8e3df3f3db24204609e6be0e`; exact [main Quality Gate #38529094461](https://github.com/carlers/mosaic-life-tracker/actions/runs/38529094461) SUCCESS, Vercel Production `dpl_2rvyzRjQk7N2e9zK68PqhxhLJ6P5` READY at that SHA, app version 0.17.4 unchanged. Main ruleset #24880070 active with zero bypass actors; protected `dev@f3d9558feca499e53c310c5a37be2794717bccf6` unchanged.
- Canary `fix/592-trusted-archive-20261014@bf56a5f84bf985370c34368f1ce0d2161d2925ec` passed full [Quality Gate #38522610668](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522610668). Its trusted receiver [#38522774415](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522774415) passed read-only checks, but protected Vercel CLI failed before a provider create with `User not found (404)` because main passed team ID to `--scope`. Provider history remained empty. #822 installs the reviewed `--team` correction on main.
- The corrected literal `fix/592-trusted-archive-20261014:false` has already produced zero Git deployments on two successful and one failed canonical push. Existing protected writer creation flag was confirmed TRUE from prior trusted run; alias switch remains OFF. No manual/device test claimed.

## Scoped task
- Add adversarial regression: recomputing an outer Actions ZIP digest cannot authorize a forged inner static archive checksum or file inventory. Assert the already-implemented trusted parser rejects both before provider creation.
- Test and checkpoint only; do not modify app code, version, Vercel branch policy, security gates, secrets, Production/dev, provider aliases, or hosted project settings.

## Next action
- Request [verify:focused] on this quiet task; once green, squash to the canary stable branch and inspect its fresh full canonical. Verify zero pre-CI Git deployments for the exact SHA, then inspect default-main Trusted Preview Delivery and protected writer. Require exactly ONE SHA-bound `--prebuilt --target=preview` READY and exact Scratch/public feature/routing/headers readbacks. If the writer fails, inspect logs and provider history before any retry or additional canary push. Alias stays OFF. Test idempotency/stale rejection/rollback; expand only after proof. #592 remains OPEN.
