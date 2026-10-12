# Session checkpoint

Updated: 2026-10-13
Current task: #592 protected prebuilt Preview canary output-root repair.
See issue #592 for complete history, CI and Vercel deployment evidence.

## Verified baseline

Stable `fix/workflow-build-parity-592-20261012@28ab3eb2af0dd2e84e37ddbae1f90cfbc152ba61`.
[Quality Gate 38287752127](https://github.com/carlers/mosaic-life-tracker/actions/runs/38287752127) SUCCESS;
Git-triggered Vercel `dpl_74EbQsPuikXnW15J5FyGvee17dP9` READY.

Owner manual dispatch `38288515284`: all canonical checks,
exact-SHA/branch, environment approval, Vercel read-only duplicate
check, pin-installed CLI, branch-scoped Preview `vercel pull`,
locked `npm ci`, and actual Vite/TypeScript build SUCCESS.
Build log: Scratch Appwrite, GIPHY enabled, Node 24.21.0,
all seven size budgets PASS. Local `vercel build` then failed
`No Output Directory named "dist" found`, before prebuilt upload.
No new canary Vercel deployment. User's configuration is valid;
do not ask to reset variables or token.

## Active task

Task branch `chatgpt/592-canary-cli-root-20261013`, based
on accepted stable SHA. Vercel project root is `life-tracker/`
relative to Git root; executing Vercel CLI from `life-tracker/`
misaligns the expected output location. Run Vercel
link/pull/build/prebuilt-deploy from **Git root** instead, while
retaining `npm ci` and all security checks in `life-tracker/`.
Require `life-tracker/dist/index.html` and
`.vercel/output/config.json` before deployment. Add workflow
regression test and diagnostics; no Vercel setting change.

## Next action

Focused task CI -> squash to stable Preview -> full canonical +
Vercel READY. Protected local prebuilt canary must then pass live
on an exact new SHA before disabling any automatic Git delivery.
Current connected GitHub tool cannot dispatch manual runs or approve
required reviewer, so keep minimizing new manual steps. Never
turn off Git delivery prematurely. The future stable Preview gate
must run automatically without per-commit manual approvals.
Do not modify dev/main, Production, Scratch or the seven budgets;
#592 remains open. Local prebuilt fingerprint from manual run
`e24cedd...` did **not** match previous hosted
`13df5b4...` for the same SHA; investigate chunk parity before
switching the deployment system.
