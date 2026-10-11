# Session checkpoint

Updated: 2026-10-11
Current task: Issue #407, repair direct-link HTTP 404 for v0.17.0 Backlogs Preview. Scope: Vercel SPA routing plus regression only; no backend, database, UI, or dev/main changes.

## Reproduction and root cause
- Stable Preview `feature/backlog-407`, SHA `fd2c05bcd2e5c327797bc3a3d851659d4189d4d6`, Vercel READY but direct `/backlog` request returns HTTP 404 `x-vercel-error: NOT_FOUND`.
- The same stable alias serves `/home` HTTP 200 and the Mosaic index HTML. The protected client router registered `/backlog`, but `life-tracker/vercel.json` explicit rewrites omitted it. This is a host-routing defect, not a new component or Appwrite error.

## Fix and acceptance
- Task branch `chatgpt/backlog-vercel-rewrite-407`: add only the missing explicit `/backlog` -> `/index.html` Vercel rewrite; keep static assets and all existing rewrite behavior unchanged.
- Regression verifies `/backlog` is a registered protected route and has the explicit `/index.html` Vercel rewrite. Preview revision candidate `0.17.1` (increment PATCH after published v0.17.0).
- Task commit should request `[verify:focused]`, then squash PR into stable `feature/backlog-407`, await canonical CI and matching Vercel READY.
- **Required live verification:** use Vercel authenticated HTTP fetch of stable alias `/backlog` to confirm status 200 and app shell, and confirm `/home` remains 200.
- Preserve existing Scratch backend. No extra user UI changes or dev/main promotion. Device/login testing remains user/manual acceptance.

Next action: focused test and diff review; squash to stable Preview after focused green; verify canonical CI, Vercel READY, exact `/backlog` HTTP 200; update issue #407. Do not close until manual user acceptance.
