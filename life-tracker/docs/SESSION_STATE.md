# Session checkpoint

Updated: 2026-10-13
Current task: issue #592 protected Preview canary dependency fix.
Authoritative status: GitHub issue #592, stable branch, canonical and Vercel.

## Accepted evidence

Stable `fix/workflow-build-parity-592-20261012@6e21f0048faf60f0aaebc8ab4654492dac41a13c`.
Full canonical `38286138996` SUCCESS; Vercel Git deployment
`dpl_BJpqufcmw6EeKfiyoC9CVdKzJGXm` READY. No dev/main merge;
auto Vercel Git Preview trigger unchanged.
Manual run `38287002114`: all canonical CI gates SUCCESS;
protected canary authorized and exact SHA/branch/variable/token checks
PASSED; Vercel duplicate history check PASSED; Vercel CLI installed;
`vercel pull` obtained branch-scoped Preview settings. `vercel build`
FAILED because the runner lacked app `node_modules` (`TS2688`
missing `vite/client`, `vite-plugin-pwa/client`, `node`).
No prebuilt deployment created. Token and owner environment settings
are working; stop asking owner to reconfigure them.

## Active task

`chatgpt/592-canary-install-deps-20261013` from stable SHA.
Add deterministic `npm ci` from lockfile after duplicate preflight,
before local Vercel build. Add regression verifying steps/gate ordering,
update diagnostics. Preserve seven size budgets and Scratch policy.

## Next action

Run focused CI on task; squash to stable Preview; verify GitHub
canonical and Vercel READY. GitHub connection cannot dispatch
`workflow_dispatch` or approve protected reviewers; future automated
Preview trigger after successful canary must **not** require owner
manual runs. The current manual protected canary requires new stable
exact SHA and review, only until a safe replacement is proven.
Inspect Vercel canary logs/metadata/alias and test idempotency before
turning off Git auto builds or relaxing any checks. #592 remains open
for automated rollout, size policy, scheduled audits, and acceptance.
