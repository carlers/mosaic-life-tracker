# Session checkpoint

Updated: 2026-10-12
Current task: **#592 Vercel / CI build parity and deployment waste**.
GitHub issue #592 and exact branch/Actions/Vercel state are the authoritative
resume source. This checkpoint concerns the active task, not release status.

## Accepted starting point

- `dev@d9d2cc1f3650889c30c43478d90e6519524c851e` and
  `main@3af1049358de4e7474d6478a335b6bb779d03b46` were unchanged when
  this batch started; recheck live heads before claiming continued immobility.
- Stable Preview `fix/workflow-build-parity-592-20261012@01f3e61d0143a4d44170004dbe0be557238fd263`:
  GitHub canonical #38275283189 SUCCESS; Vercel deployment
  `dpl_AHQ35ioGaScsRysmLac9SsQzGD6y` READY with Scratch backend.
- Same SHA produces GitHub GIPHY-disabled and Vercel GIPHY-enabled JS/CSS:
  raw difference +2,214 B; SHA-256 fingerprints differ. Both use Node
  24.21.0/Vite 8.3.0. See `docs/BUILD_PARITY_DIAGNOSTICS.md` and #592.

## Active isolated task

- Branch `chatgpt/592-protected-preview-canary-20261012`, based on accepted
  #592 stable Preview; no app version change.
- Added a **default-disabled** manual Quality Gate `preview_canary` job after
  canonical acceptance, with owner repository opt-in, protected environment,
  exact SHA/ref/repository/Vercel scope checks, live GitHub canonical check,
  Vercel duplicate check, effective branch Preview `vercel pull/build`,
  second exact-SHA check, and optional prebuilt-only Preview deployment.
- Files: `.github/workflows/quality-gate.yml`,
  `scripts/lib/preview-canary-context.mjs`,
  `scripts/check-preview-canary-{context,duplicate}.mjs`,
  `tests/unit/previewCanaryContext.test.ts` and parity docs.
- Focused CI first attempt #38278448883 FAILED on the existing
  `documentationContracts` generated-handoff ≤3000-token requirement
  (3143), caused by accumulated obsolete `SESSION_STATE.md` prose.
  This edit condenses the checkpoint rather than weakening the limit.

## Next action and constraints

Rerun focused task gate after checkpoint repair; then task PR and squash to
the same stable Preview for full canonical + Vercel verification. No canary
execution until a reviewed, reviewer-protected GitHub environment, its token,
and explicit repository enable variable exist. **Never** switch off Git-triggered
Preview delivery before actual canary SHA/Scratch/alias/idempotency acceptance.
No budget weakening, secret exposure, backend mutation or `dev/main` promotion.
#592 remains open, including periodic audits and five-eligible-promotion pilot.

## Other in-flight context

#692 Calendar zoom's October 12 integration checkpoint previously used this
global session file: accepted `feature/calendar-zoom-692-20261012@b70bda97`,
combined `feature/calendar-zoom-692-dev-integration-20261012` (v0.23.4)
and Scratch/canonical requirements. Its issue, branch and CI outrank this
historical note; do not infer #692 completed or authorize its promotion here.
