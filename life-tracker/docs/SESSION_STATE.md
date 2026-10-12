# Session checkpoint

Updated: 2026-10-13
Current task: #592 automatic Preview shadow/alias separation and trust review.
Issue #592 and live GitHub/Vercel results are authoritative.

## Verified baseline

Stable `fix/workflow-build-parity-592-20261012@a012652bdcf7cce9df5f7088b9e10bc79761cf7b`;
[Quality Gate #38315341113](https://github.com/carlers/mosaic-life-tracker/actions/runs/38315341113)
SUCCESS, Git Preview `dpl_3b1MztN512TErhG5tsoC4vP1jab4` READY
with stable alias, auto pilot SKIPPED by default.
Protected manual prebuilt canary `38290165183` attempt 2 SUCCESS,
CLI Vercel deployment `dpl_9CgjZjmxMCqSqZxEkSpVspxKbB3d` READY.
No dev/main or Production change.

## Active task

`chatgpt/592-preview-shadow-gate-20261013`: create a second,
independently OFF variable `MOSAIC_AUTO_PREVIEW_ALIAS_ENABLED`
for a **two-phase** rollout. The existing OFF-by-default
`MOSAIC_AUTO_PREVIEW_ENABLED` controls whether an accepted exact-SHA
stable-branch push can build/deploy a standalone Preview. The
alias mutation, revalidation and readback steps all require the
separate alias switch; shadow READY verification still runs.
Strengthen alias script guard and reject unknown Vercel targets.
Unit regressions and parity diagnostics added.

## Next action

Focused task CI; squash to stable Preview; full canonical CI and
Vercel Git Preview READY; update #592 with real evidence.
**Do not enable either auto toggle** or disable Git-triggered
Previews. Critical trust concern: a no-review secret-bearing
environment restricted only by branch cannot safely run mutable
workflow/build scripts from that branch without stronger source
and credential isolation. Harden trusted workflow and environment
rules before any owner one-time setup. JS/CSS fingerprints of
same-SHA hosted vs CLI still mismatch despite both showing
Scratch/GIPHY enabled, Node 24, 150 assets; investigate causality.
Keep dev/main and all seven budgets untouched. #592 remains OPEN
for rollout, scheduled audits, budget policy and 5-promotion pilot.
