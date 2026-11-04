# Task relative-day shortcuts — v0.89.0 integration

Owner-approved destination: `dev`. Do not touch `main` or Production.

- Base: `dev@fd8a98b58aeac8fd42c3f3467df3dbbc745b5169` (v0.87.0, includes approved private-feedback work).
- Prior candidate: `feature/task-relative-day-actions-v0880-20261105@4930e59ee446efb4362c493776bfe530326e0106`. Its Vercel build was READY but canonical CI #41884368916 FAILED: TaskActionSheet React refs ESLint (in added action handler) and one chat-scroll browser test.
- Another active diary Preview reserved 0.88.0. Integration moves this task to 0.89.0, retaining the feedback work from current dev.
- Repair React refs error by using the action's in-flight state as the duplicate-tap guard; no chat-scroll changes without separate evidence.
- Scope: existing TaskActionSheet/DayViewSheet/BulkTaskActionSheet, the new local task-day helper, related four regression suites, three version files, and this checkpoint only. No database, Appwrite, or service changes.
- Integration branch: `chatgpt/task-relative-day-integration-v0890-20261105`. Intended stable Preview: `feature/task-relative-day-integrated-v0890-20261105`.
- Required: focused checks, canonical stable Preview CI, exact-SHA official Scratch Preview READY, guarded PR to dev, canonical dev CI, and verified exact-SHA stable dev PWA alias. Keep issue/preview scope separate from dev promotion approval.

This scoped handoff is kept separately from `docs/SESSION_STATE.md` to preserve its existing long-running concurrent-work record.
