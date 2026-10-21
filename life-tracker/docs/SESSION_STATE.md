# Session checkpoint

Updated: 2026-10-21 UTC
Current task: #404 Preview v0.40.2 — canonical Home bundle-size repair
Issue #404 Preview v0.40.2 — true full-height split, fixed left-grid snap and calm transitions.

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

## Latest gate repair
- Stable v0.40.2 candidate `8bed5b2f304503d4a528de7b085461897a4881dc`: full CI [39556385411](https://github.com/carlers/mosaic-life-tracker/actions/runs/39556385411) passed checks, DOM, browser, audit, but blocking Home closure 381,293 / 381,000 bytes. No Vercel delivery.
- Scoped repair moves left/right arrangement from Home useState and three-layer callbacks into portal-derived CSS :has rule, retaining same full-shell layout without extra startup state. Embla reInit then immediate explicit snap after actual resize. Update DOM portal test accordingly; no version increment or release limits changed.
- Task branch `chatgpt/404-screen-split-budget-20261021`: focused gate, then squash to stable Preview, full canonical gate and trusted READY exact SHA required. Manual wide-screen left/right validation and animation/device checks not yet performed. Do not promote dev/main.

## Follow-up canonical repair
- Stable Preview `54813673401736d04b5dc8ab97dc59fc1d11db45` CI 39558353190 passed DOM/checks/browser/audit but Home closure was +273 bytes. No gates changed.
- The active Calendar now measures its nearest Home workspace and resolves its sibling screen portal on actual day selection, reducing Home and owner/friend startup props. Lazy resize handle computes workspace bounds on pointer drag. DOM test validates portal without injected refs. Version remains v0.40.2. Pending focused/full/READY gates.
