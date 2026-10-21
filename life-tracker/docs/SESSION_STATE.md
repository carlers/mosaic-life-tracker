# Session checkpoint

Updated: 2026-10-21 UTC. Issue #404 Preview v0.40.2 — true full-height split, fixed left-grid snap and calm transitions.

## Baseline and authority
- Exact stable Preview base: `feature/split-day-panel-dev-404-20261021@5249f72df87f54bcd10bac9c8d8fece3662a7210` (v0.40.1), canonical CI 39553606512 success and trusted READY Vercel deployment dpl_ARSc4xJLkBxWMvrivuVSeFo9hXxT. No `dev` or `main` promotion approval; `dev@e1c90b387ecfb4e29d64c88b6557703dd23ca207`.
- User-provided screenshot of left side panel showing month columns clipped/partially scrolled, jitter on settling, and clarification: Grid height must match pre-v0.40.1 default, while Screen height means full Home workspace split, including search/hamburger, person and date headers on the opposite/calendar side. Bottom nav remains in shared application chrome.

## Scoped implementation
- Move optional full-height inspector to a Home-level portal sibling rather than a child under the date header. Home root flexes calendar entire shell and inspector; left or right side preference controls overall order. Active person changes and panel close clean up the portal layout. No backend or settings schema changes.
- Grid height retains old v0.40.0 height: entire CalendarBody available height, not measured week rows.
- Eliminate split width animation causing Embla repeatedly re-measure during opening/closing; reserve bounded panel width immediately while panel itself transitions opacity/translate (motion-aware). Keep mounted editor until exit is complete, and release width only after exit.
- Keep explicit viewport ResizeObserver reinit and logical Embla snap on width changes and divider releases. Preserve calendar full 7-column grid, current pinch, keyboard, task editing, friend panel, history layering, and narrow sheet fallback.
- Bump one PATCH version to v0.40.2, including package and lock.

## Verification and handoff
- Task branch `chatgpt/404-true-workspace-split-20261021`; request focused CI in task commit, repair failures, squash to stable Preview, require canonical acceptance and trusted exact-SHA READY Vercel before sharing new link.
- Manual wide-window tests still required: first/last weekday columns visible after opening left, switch month and resize divider; smooth close/open and side switching; full-screen shell correctly relocates search/hamburger and date header; reduced motion, owner/friend, browser Back, narrow fallback and offline draft retention.
- Never promote dev/main or Production without explicit approval.
