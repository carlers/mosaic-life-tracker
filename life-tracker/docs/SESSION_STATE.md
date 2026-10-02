# Session checkpoint

Updated: 2026-10-02
Current task: Polish Home task-entry/select-mode UI and make Calendar/Todo date headers return to the month containing today.
Status: Implementation, regression coverage, and product-contract updates are committed on `chatgpt/ui-home-polish` from current `dev`. The pending task-title input now matches normal/editing task text size; select mode preserves completion-circle visuals and uses only the row background for selection; Calendar and Todo date titles are unconditional Go to today controls for both owner and friend panes. The obsolete preference toggle/key was removed so no setting can disable the required behavior.
Next action: Wait for this exact SHA's full canonical Quality Gate. If green, squash the accepted task branch into a stable `feature/*` Preview branch, verify the Vercel Preview is READY, then hand off the UI for manual visual acceptance. Do not promote to `dev` without explicit user instruction.
Blockers: No known source or schema blocker. Local execution is unavailable in this chat environment, so verification is delegated to the repository's exact-SHA GitHub Actions gate.

## Completed
- Matched pending add-task title typography to existing task/edit title sizing without changing neighboring layout.
- Kept completion circles visually tied to completion state in selection mode; selection remains row-driven and the selected row uses background highlight only.
- Made shared Calendar/Todo titles clickable whenever those views are active.
- Added owner and friend Todo month-reset wiring and kept Calendar's existing reset-to-today behavior.
- Removed the obsolete synced "Tap calendar date header to go to today" preference UI/key.
- Updated DOM regression coverage for unconditional Calendar/Todo title navigation and remaining Preferences controls.
- Updated `PROJECT_REFERENCE.md` §2 with the new durable UI/interaction contracts.

## Verification
- Source/diff review: completed before commit.
- Local focused tests: unavailable in this connected-chat environment because the repository is not mounted.
- Exact-SHA full canonical acceptance: requested by the final commit via `[verify:full]`; pending.
- Stable Preview deployment/manual visual acceptance: pending canonical acceptance.
