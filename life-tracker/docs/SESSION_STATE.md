# Session checkpoint

Updated: 2026-10-11
Current task: reconcile accepted Backlogs issue #407 into the latest dev without overwriting concurrently promoted features. User explicitly approved dev promotion, not main.

## Product / safety
- Backlogs is `/backlog`, a date-free, category-grouped Day View with normal task actions/reorder, Home hamburger and Me entry points, Home search focus, and Calendar ⇄ Backlogs moves by updating the same task's `date` to/from `''`.
- Owner-only Backlogs privacy: scheduled-date validation guards friend calendar, reactions, task retrieval, completion notifications and **shared-task list/invite/collaborator mutations**. Hide Share with friends for undated tasks in task actions.
- No new schema or backend collection. Shared task code remains from dev; the combined Git-owned Function requires Scratch readiness before authenticated acceptance.

## Reconciliation
- Accepted original Backlogs Preview: `feature/backlog-407` SHA `9f5c7d9a54bedc2bf7da3cc19add559cb16a760f`, v0.17.1. Canonical run 38117719036 SUCCESS (second attempt), Vercel READY; direct stable alias `/backlog` and `/home` HTTP 200.
- dev advanced independently to `9671c64c0c6519bd2773a22e5bd498f9cc367778`, v0.17.0, with shared tasks, stickers, granular release history and Settings swipe-forward. Direct PR #581 cannot merge cleanly. Merged source is based on latest dev, preserving newer shared/Settings work and layering backlog route and privacy. New combined Preview revision **v0.17.2** avoids reusing v0.17.1 on a materially different tree.
- Keep dev's newer build budgets and release-history changes; measure combined build before changing limits. Legacy backend `message-action` is reconciled, but Scratch Function deployment/auth parity must be rechecked; do not assume production backend deployment or device acceptance.
- Task integration branch `chatgpt/backlog-dev-reconcile-407` is built from the accepted Preview ancestry plus the latest dev ancestry in a 2-parent reconciliation commit, with a combined tree matching latest dev plus selected backlog changes. Squash after checks to stable `feature/backlog-407`, where canonical CI and Vercel validate; then merge accepted stable Preview by PR #581 into dev.

## Acceptance
- Explicit full task diagnostic when needed for tight combined build size, then focused checks on final task SHA; canonical full Preview acceptance and exact-SHA Vercel READY before dev merge.
- Dev PR must retain accepted Preview tree and run current promotion gate; verify dev CI, Scratch Vercel deployment, direct /backlog 200. Main and production untouched.
- Real Scratch authenticated multi-device testing, Android/iOS swipe and theme/visual testing remain separate from automated evidence; do not claim them without execution.
