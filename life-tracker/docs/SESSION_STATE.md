# Session checkpoint

Updated: 2026-10-09
Active task: #402 completion-status task grouping, implementation approved.
Baseline: `dev` `15c7df12ac43e941b38018bee86efdc06097b567` (v0.7.1).
Task branch: `chatgpt/task-completion-sorting`.
Stable Preview target: `feature/task-completion-sorting`.
Candidate version: **0.9.0**. Pending v0.8.0 #410/#416 Preview is separate and must not be implicitly merged. #417 Settings cleanup follows as an independent issue; #404 is out of scope.

## Approved behavior

- Owner-synced Task completion order: Manual (default), Completed first, Completed last, grouped within each category in Day View and inline Todo List.
- Completion regrouping is a render-only projection. Preference toggles and task completion do not write manual order fields. Clipboard follows visible ordering.
- **All same-category and cross-category drops remain enabled in every mode.** In automatic modes, drop category is honored, but completion grouping overrides the exact drop slot. Same-completion peers can be reordered while opposite-status manual peer ordering is preserved. Canonical persistence receives translated manual placement, never the raw sorted display array.
- Reject stale drag snapshots on date/account/category/status/task-membership changes. Manual-mode drag behavior remains unchanged.
- Change only feature source, relevant tests, version and current checkpoint. No Appwrite backend or schema changes.

## Verification and delivery

- Add table-driven unit regressions, a Preference DOM interaction assertion, and preserve existing DnD/browser tests.
- Task branch focused CI, then squash merge to stable Preview and require exact-SHA canonical CI and Vercel READY. Appwidth changes are not included.
- Physical phone drag/cross-category plus sorting acceptance is still required before dev promotion. Dev/main need separate user authorization.
- Next action: verify coherent task branch changes; fix failures in task branch, publish stable Preview; then begin #417 on a separate branch.
