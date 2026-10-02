# Session checkpoint

Updated: 2026-10-02
Current task: Add a synced Preferences toggle controlling whether newly created tasks are inserted at the top or bottom of their date/category list.
Status: Implementation is on `chatgpt/ui-home-polish-task-position`, based on stable `feature/ui-home-polish` at `3d7569d`. The new **Add new tasks to top** switch defaults off to preserve existing bottom-insertion behavior. Day View/Todo task creation passes the selected placement into `useTasks.addTask`; bottom uses max order + 1, while top uses order 0 and the existing newest-created-first tie-break.
Next action: Complete exact-SHA canonical verification. If green, squash-merge this follow-up into the same stable `feature/ui-home-polish` branch, verify the refreshed Vercel Preview is READY, then hand off for manual acceptance. Do not promote to `dev` without explicit user instruction.
Blockers: No known source, data, or schema blocker. Settings storage is generic, so no database migration is required.

## Completed
- Added synced setting key `addTasksToTop` and a Preferences → Tasks switch labeled **Add new tasks to top**.
- Preserved bottom insertion as the default for existing users.
- Added explicit top/bottom placement support to `useTasks.addTask` without renumbering sibling tasks.
- Wired Day View and Todo inline task creation to the synced preference.
- Added Preferences, Todo integration, and task-order regression coverage.
- Updated the durable task preference and ordering contracts in `PROJECT_REFERENCE.md`.

## Verification
- Source/diff review: pending after commit.
- Exact-SHA full canonical acceptance: pending.
- Stable Preview deployment/manual acceptance: pending canonical acceptance.
