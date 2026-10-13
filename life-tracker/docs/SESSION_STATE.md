# Session checkpoint

Updated: 2026-10-13
Current task: #784 offline/synthetic mobile startup diagnostic experiment.

## Verified baseline

Based on protected `dev@d7656e2513e5ee9d339814890cd7f707f18461d6`,
with the seven existing budgets, PWA invariants and #592 delivery unchanged.
Historical 76-build analysis and seven-metric correlations are recorded at
https://github.com/carlers/mosaic-life-tracker/issues/784#issuecomment-6148756649.
No runtime-performance baseline has been accepted yet.

## Active implementation

Isolated `chatgpt/784-mobile-startup-audit-20261013` task branch introduces
one advisory no-deploy GitHub performance-audit pilot, separate Playwright
production-build throttled-Chromium cold-start test, and size:report from the
same built dist. Synthetic cached offline account only; Appwrite requests
blocked; no real phone or authenticated Home claims. Read-only token and
no provider POST/Preview pipeline; all seven legacy hard limits remain
in canonical acceptance. Weekly main-owned schedule is inactive until the
workflow is separately promoted to default branch. No UI version impact.

## Next action

Verify initial pilot CI branch push, inspect generated size + mobile startup
artifacts, repair any missing readiness fixture/runner behavior and gather
repeatability samples. Compare one or more real size-regression fixtures
against the simulated runtime. Review exact measured signal, then obtain
an evidence-led policy cutover decision: hard/warn/report split and a
rollback plan. Do not change current seven acceptance guards, dev/main,
main-owned deployments, Appwrite or #592 settings before verification.
