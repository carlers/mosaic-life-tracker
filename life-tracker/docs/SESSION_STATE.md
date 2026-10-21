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

## Third size-gate fix (structural)
- Canonical Preview `566d97d613eaaf5d8df5c17645ca912b9d6ee280` failed strict Home closure by 249 bytes in run 39559047358, while other suites passed. No size limit changes.
- Refactor moves frame ResizeObserver, screen portal resolution and responsive split state into the already lazy-loaded DayDetailPanel. CalendarBody only measures width on a day-selection event to decide sheet/panel and passes the initial width. Grid left placement is derived from the mounted inspector's data attributes; screen placement remains from Home-level portal CSS. Preserves active-panel resize and nested editor history, without increasing default Home code. Keep v0.40.2 and require full acceptance and exact-SHA READY.

## Fourth size-gate repair: lazy stylesheet
- Stable candidate `496a6f7b0c6ba15fd67541caafbe28b3962d452a` run 39559807501 Home static closure 381,173/381,000 bytes (+173); full build-size gate blocks Preview. Other checks remained green.
- Move two split-only CSS :has placement rules out of global startup stylesheet into `src/components/home/views/dayDetailPanel.css`, imported only by lazy DayDetailPanel chunk. Move height preference snapshot into that lazy component, keeping editing mode stable across preference sync, and remove eager manual preload from CalendarBody (lazy mount still imports on first day selection with its existing local Suspense fallback). No budget changes, v0.40.2 retained.
- Next: task focused CI, stable squash, full canonical, trusted exact READY Vercel then user acceptance. No dev/main promotion.

## Fifth canonical optimization
- Stable v0.40.2 `8fd111c7b88c612d816e8e1d18ad25e2fd7215d1` full Quality Gate run 39560449743 still above Home closure by 75 gzip bytes (381075/381000). No budget change.
- Split-only styles and height state now lazy. Replace unused createPreloadedLazy helper (no longer manually prewarmed) with React.lazy plus a panel-local Suspense boundary, keeping the Calendar mounted while the panel import resolves. No markup/layout/data behavior change. Full acceptance and exact Vercel still required.

## Sixth candidate: preserve retryable lazy mount + remove redundant warmup
- Stable `368e615b04095409896518bb62a2fbfc863b6f92` full run 39560948733 failed only Home startup closure +80 gzip bytes. Revert native React.lazy to repository-standard retryable createPreloadedLazy (internal local Suspense), remove duplicate friend preload from day click (pointer and lazy paths remain), and remove unused Home test IDs while retaining semantic slot attribute. Strict limits and v0.40.2 unchanged. Pending focused → canonical → trusted READY.
