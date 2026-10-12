# Session checkpoint

Updated: 2026-10-13
Current task: #592 protected Vercel Preview canary: bounded history fix.

## Verified baseline

Stable `fix/workflow-build-parity-592-20261012@335da4c58a4b7c1855386b9807a304590e25e9d6`;
full GitHub Quality Gate `38283876942` SUCCESS, Vercel
`dpl_CXz7tAKNXZ4JDo1RbMgPjB2SqKHP` READY. Ordinary Git-triggered
Preview preserved; no `dev/main`, Scratch or Production changes.

Owner dispatched manual Quality Gate `38284531918`. First attempt
browser-contract shard 2 intermittently sent a task to populated `cat_1`
instead of empty `cat_2`, same regression seen in past #592 run.
Agent retried failed jobs only, attempt 2 browser shard SUCCESS;
canonical-acceptance SUCCESS. After owner approved protected
`mosaic-preview-canary`, manual SHA/ref/variable/repository checks,
GitHub canonical evidence and Vercel token presence PASSED.
Duplicate-check step failed on `Canary deployment history exceeded
bounded inspection`: legacy search paged >500 historic deployments.
**No prebuilt deployment was attempted.**

## Active task

`chatgpt/592-bounded-canary-history-20261013` from stable SHA.
Limit duplicate search to deployments created since candidate Git commit
timestamp minus 1 hour; keep five-page cap and fail-closed invalid
history/pagination, branch/SHA validation and READY/active detection.
Live Vercel read-only `since` filter for the current commit's one-hour
safety margin returned **3 deployments**, no canary metadata.
Add focused regression and update parity diagnostics.

## Next action

Focused task CI; squash to stable #592 Preview and verify exact-SHA
canonical+Vercel READY. Existing GitHub connector cannot dispatch a
fresh workflow or approve protected environments, so a later owner
manual canary on **new stable SHA** is still required. Inspect its
protected build and deployment logs and SHA/Scratch/alias evidence.
Do not disable automatic Git Preview deployments before successful
proof. No build-size budget or Appwrite change. Issue #592 remains OPEN;
budget policy, scheduled audits and five-promotion pilot pending.
