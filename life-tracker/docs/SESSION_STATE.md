# Session checkpoint

Updated: 2026-10-01
Current task: Promote the accepted task-reorder/day-swipe release from `dev` to production `main`.
Status: `dev` promotion is complete and fully green. Production preflight required Mosaic to advance from `0.1.0` to `0.2.0`. The first full release gate correctly exposed two stale tests that still hard-coded `0.1.0`; both are fixed, PROJECT_REFERENCE now records `0.2.0`, and exact-SHA full verification is rerunning on `chatgpt/release-task-reorder-0-2-0` before it enters `dev`.
Next action: Pass full canonical verification for the 0.2.0 release bump, squash-promote it into `dev`, verify the new dev SHA/deployment, then merge `dev` into `main` and verify production CI plus Vercel Production READY.
Blockers: None.

## Accepted release content
- Fresh-open and legacy multi-task rows render correctly.
- Same-category, populated cross-category, and empty-category reordering work across consecutive drags.
- Category-boundary drag projection is visually stable.
- Quick mouse drags over task title/memo navigate days; stationary 500 ms title holds reorder.
- Neighboring Day View slides keep identical vertical geometry while becoming active.
- Reorder implementation cleanup is complete and manually accepted.

## Dev promotion
- `feature/task-reorder-clean` was merged into `dev` as `9025cd37683af9cbb545c36881203a1ecb09efb7`.
- The exact dev SHA passed the full Quality Gate, including both DOM shards, both Chromium shards, dependency audit, and canonical acceptance.
- The matching dev Vercel deployment is READY.
- `dev` is ahead of `main` with no reverse divergence.

## Release version
- This release adds a meaningful backwards-compatible product capability.
- Per `docs/VERSIONING.md`, the pre-1.0 release version advances from `0.1.0` to `0.2.0`.
- `package.json`, `package-lock.json`, and `src/lib/appVersion.ts` are kept in sync at `0.2.0`.
