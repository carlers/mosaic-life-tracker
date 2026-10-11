# Session checkpoint

Updated: 2026-10-11 UTC
Current task: First-open Calendar Day View performance optimization (frontend only).

## Starting point
- Verified `dev=80f1dd10b66b0e4965ce88ed4dcbfcaf575db777` (v0.17.6); fast-forwarded the task branch to include the concurrent task-photo and build-budget changes.
- Task branch: `chatgpt/day-view-idle-warmup-20261011`; planned stable Preview: `perf/day-view-idle-warmup-20261011`.
- Planned user-testable patch: v0.17.7. Recheck current dev and other active Preview versions before promotion; the separate bucket-list Preview currently uses v0.18.0.
- Other active issues, including #592, keep their own issue checkpoints and independent branches.

## Scope
- Reuse one retryable dynamic Day View module import from Home Search and Calendar.
- Warm the import after Home's local task/category/carousel readiness, during idle time; keep the closed sheet unmounted, preserve the seven-slide buffer, and allow immediate user interaction to load on demand.
- Add module-dedup and idle-mount regression coverage; document the startup invariant. No backend schema, Function, or Production changes.

## Verification and next action
- The task commit requests `[verify:focused]`. Inspect actual Actions results and repair failures.
- After focused success, squash into `perf/day-view-idle-warmup-20261011` and verify canonical acceptance, version, Vercel Preview and user/device acceptance.
- Never merge to `dev` or `main` without separate approval. Compare actual startup/open timing and bundle sizes; device timing is pending.
