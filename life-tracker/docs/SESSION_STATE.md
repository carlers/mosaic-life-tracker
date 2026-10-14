# Session checkpoint

Updated: 2026-10-14
Current task: #592 isolated Git auto-deployment cutover prepared — **DO NOT MERGE YET**.

## Verified foundation
- `main@8df24c13` v0.17.4, exact canonical #38505671065 SUCCESS, Production READY; ruleset protected with zero bypass actors. Trusted read-only CI artifact receiver live SUCCESS #38506275297 on accepted canary SHA 56ceb5af, verifies 161 files/routing, creates zero extra deployments.
- `dev@f3d9558f` v0.23.4 and automatic Git deploy remain unchanged.
- Separate main-based writer stable `fix/592-main-prebuilt-writer-20261014` contains default-OFF prebuilt CLI writer with independent canonical/current-SHA, provider identity, deduplication and explicit Preview targeting. Do not enable writer until reviewed, merged to protected main and its Production/main checks pass.

## Current isolated canary draft
- Vercel's git.deploymentEnabled rule matcher is additive. A canary-specific false cannot override broad `fix/*: true`. This task replaces that one broad allow-rule with `fix/!(592-trusted-archive-20261014): true`; existing `*: false` and the explicit main/dev/feature/perf/security/refactor rules remain unchanged.
- This draft intentionally disables provider Git auto-creation only for this single canary **after merge**. Do not merge while main is missing the accepted protected writer, and do not turn on provider creation flags yet.
- A new doc/unit regression checks exact config and preserves 15 SPA rewrites and security headers. Vercel provider behavior is NOT proven until a controlled red/green canary. Rollback is to restore `fix/*: true` and disable provider writer flags.

## Next action
- Focused task CI only; open draft task→stable PR but leave unmerged.
- Main writer full canonical+READY, owner-approved new narrowly scoped main ruleset exception, and main Production readback FIRST.
- Then review/minimatch config and merge this isolated canary change; verify a red candidate creates ZERO Git deployments, a canonical green candidate creates exactly one trusted prebuilt Preview, stale/retry creates zero new deployments, browser Scratch/deep links/headers and alias rollback. #592 OPEN.
