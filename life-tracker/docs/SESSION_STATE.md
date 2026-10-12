# Session checkpoint

Updated: 2026-10-13
Current task: #592 protected Preview canary skip-propagation repair.
Issue #592 and exact branch/Actions/Vercel status are authoritative.

## Accepted baseline
- Stable `fix/workflow-build-parity-592-20261012@b31b7c357ce44f0d249194f790c248caf1ef3274`.
- GitHub canonical `38278831802` SUCCESS; hosted Vercel
  `dpl_9ttUkTrPYs7WM4qaNb74ozgRLXrh` READY, Scratch backend,
  GIPHY enabled, Node 24.21.0, unchanged seven budgets PASS.
- GitHub and Vercel JS/CSS fingerprints mismatch at same SHA because
  CI GIPHY disabled, hosted GIPHY enabled. Do not claim full parity.
- `dev@d9d2cc1f`, `main@3af10493` at previous readback; recheck.
- Canary is manual-only, opt-in, protected by environment and token,
  exact SHA, Vercel branch/project, canonical CI and duplicate checks.
  Vercel Git-triggered delivery has **not** been disabled.

## Active repair
- Owner screenshots confirm repository variable
  `MOSAIC_PREBUILT_CANARY_ENABLED=true`, protected
  `mosaic-preview-canary` environment token/reviewer/branch, and exact
  manual SHA input. Manual runs `38280478916` and `38282072296`
  fully passed Quality Gate but `protected-preview-canary` SKIPPED.
- Probable cause: inherited implicit GitHub Actions `success()`
  propagates skipped `promotion_check` ancestor despite successful
  `canonical_acceptance`. Reference: GitHub Actions runner #2205.
- Task `chatgpt/592-canary-skipped-needs-20261013` from stable SHA
  changes canary job-level condition to `always() && !cancelled()`
  **in addition to** all original fail-closed manual/SHA/opt-in/
  canonical checks. Adds workflow YAML regression and docs.
- Next: focused task CI; squash to stable Preview; full canonical
  and Vercel readiness. Then owner can dispatch one new manual run
  using the **new stable commit SHA** and approve reviewer request.
  Inspect token-dependent steps before claiming canary accepted.

## Safety / remaining
No `dev/main` merge, Production/Appwrite or Vercel Git trigger
changes. Preserve size budgets. A successfully running canary still
needs exact SHA/Scratch/GIPHY/artifact/alias/idempotency acceptance
before disabling any auto Preview deployment. #592 remains OPEN
with scheduled audit, budget parity/policy and promotion pilot tasks.
Historical unrelated #692 Calendar zoom checkpoint lives in issue
and integration branch; do not infer its promotion here.
