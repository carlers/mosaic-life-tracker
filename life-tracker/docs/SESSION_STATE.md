# Session checkpoint

Updated: 2026-10-14
Current task: #592 CI-first Preview delivery — first live main-owned shadow acceptance.

## Exact verified state
- Protected `main@8df24c13de16c28a5a1c6154199da5e19506f089`, app 0.17.4 unchanged, [Quality Gate #38505671065](https://github.com/carlers/mosaic-life-tracker/actions/runs/38505671065) SUCCESS, Vercel Production `dpl_Gd2R2kYEU51syibVbSufpNgtJFv9` READY, GitHub ruleset #24880070 active with zero bypass actors. Owner merged infra-only [PR #807](https://github.com/carlers/mosaic-life-tracker/pull/807) using merge commit; no app release.
- Protected `dev@f3d9558f`, app 0.23.4, #784 2 blocking/5 advisory size metrics unchanged. #784 twice-weekly mobile audit separate from #592.
- Stable canary `fix/592-trusted-archive-20261014@5f2d11c64037703709e1a99a4ce109c4e731893e`, full Quality Gate #38504457746 SUCCESS, exact Git Preview `dpl_AQoiYJPDsmFV6ydJBH9YTsCxKV1X` READY. Owner verified public Preview GIPHY/PostHog inputs mirrored to masked GitHub Actions Secrets. No private provider credentials in untrusted builds.

## Trusted artifact admission
- The new default-main `Trusted Preview Delivery` workflow listens only for a fresh completed successful push Quality Gate on the single approved stable canary branch. Runner uses main-owned Node-only code, GitHub read token, no Vercel token, environment, POST or alias.
- It rechecks exact source SHA/branch/latest HEAD, same-suite canonical success, run attempt, one matching 16 MiB bounded GitHub artifact ZIP with GitHub SHA256, six file members, tar/inventory, Scratch/Node24/GIPHY/PostHog and #784 hard sizes, pinned 15 SPA rewrites + 4 security headers; then rechecks source/CI. It never executes candidate code or rebuilds in a secret-bearing job. Invalid evidence fails closed.
- No Vercel quota savings yet: original Vercel Git integration still builds before canonical CI. The prebuilt writer/controlled rollout is outstanding. Issue #592 remains OPEN, despite an accidental close during main PR merge.

## Next action
- This documentation-only task checkpoint triggers one *fresh* canonical green stable push via the normal focused task→stable squash. Observe actual default-main read-only receiver completion and exact artifact evidence without a second provider POST/alias; diagnose failure and repair.
- Implement separately reviewed provider Preview-only prebuilt upload, trusted idempotency/dedupe/alias and rollback, red=zero, green=one, stale/retry=zero, then one real feature Preview→dev acceptance. No direct changes to protected dev/main or provider configuration without further approval.
