# Session checkpoint

Updated: 2026-10-20 UTC
Current task: issue #956 — Day View first-category focus and task keyboard drag collision (v0.35.1).

## Authority and baseline
- Owner tested v0.35.0 Preview, then reported two keyboard regressions: opening Day View requires several Tabs before Up/Down, and Enter/Space on a task title starts a drag instead of editing/toggling completion.
- Stable Preview `feature/dayview-keyboard-956-20261020@d28af4390b5cfb5d371acdf9a7460fb2d3fae97e` has exact-SHA canonical CI SUCCESS (39440461373) and Vercel READY (trusted delivery 39440788826). `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0` unchanged at task start.
- Scoped task branch `chatgpt/956-focus-dnd-keyboard-20261020` based on accepted Preview. Next user-testable PATCH version v0.35.1. No dev/main/Production authorization.

## Scoped repair
- DayView sheet auto-focuses first accessible category in the active slide after the modal focus trap mounts; once per opening, not on day changes, snap-backs, nested sheets or while editing/search focus is active.
- Keep task Enter/Space action handling; dnd-kit KeyboardSensor declines task-title activation while retaining pointer delay/drag and keyboard drag on unrelated surfaces.
- Add targeted DOM regression for opening focus and sensor target guard; preserve existing gesture, selection and shortcut tests.
- First focused task gate (39442771122) stopped at react-refresh/only-export-components because the configured sensor was exported from a component module; corrected by moving that sensor to a non-component module, updating its regression import and generated component inventory. Recheck focused CI on the repair commit before Preview squash.
- Bump package, package-lock and appVersion to v0.35.1; no backend/schema changes.

## Delivery
- Make one task commit [verify:focused], repair failures, squash to stable Preview, confirm full canonical CI and exact-SHA trusted Vercel READY.
- Manual keyboard/device, physical WebKit and screen-reader acceptance not performed; user acceptance required before explicit dev promotion. Issue remains open; phases 2–3 deferred.
