# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #956 Stage 3 (Home Calendar grid keyboard flow), Preview v0.35.3 candidate.

## Authority and baseline
- User accepted v0.35.1 keyboard fixes and authorized Stage 2; Phase 2 accepted on stable Preview `feature/dayview-keyboard-956-20261020@45d1b8fd1c91340ab198ade781f4530767c8f77a` with canonical CI 39448183162 SUCCESS, trusted Vercel 39448561091 SUCCESS and exact-SHA READY.
- User said "ok good lets move on to home page esp calendar grid and stuff", authorizing a scoped Stage 3 Home keyboard implementation without auto-merging to `dev`/`main`. `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0` at task start; `main@c938c825370f8270b46f19119b06a1f74d35842b`.
- Task branch `chatgpt/956-home-calendar-keyboard-20261020` forked from stable Preview exact SHA. Next user-testable PATCH v0.35.3 (not a production release).

## Scope
- Month and Week Calendar grids gain one Tab stop for the active date in the active carousel slide; arrow keys navigate one day/one row, Home/End reach week endpoints, PageUp/PageDown reach same date in previous/next month/week. Enter and Space retain native day-open semantics. Arrow navigation across visible carousel periods restores focus to the requested date after the new slide commits, not a hidden neighbor's duplicate spillover button. Pointer/touch, horizontal gestures, 3/4/7-day zoom, week start preference and existing calendar month controls remain.
- `G` in an active, unobstructed calendar focuses the current grid day; `/` from Home outside editors and modals opens the existing task search. Inputs, IME, modifiers, dialog ownership, other routes and inactive friend panes must not intercept keys.
- Update `DayCell`, `MonthView`, `WeekView`, `CalendarSlide`, `CalendarCarousel`, `CalendarBody`, `HomePage` and a dedicated `useCalendarGridKeyboard` controller. Add DOM regression tests; no backend changes, schema changes, or new global navigation in Settings/Messages/Alerts.
- No new design or color changes beyond a visible focus ring for day cells; retain category/task shortcut behavior from Stage 1/2.
- File inventory and version manifest updated for new module and v0.35.3.

## Delivery and handoff
- Commit scoped task patch with [verify:focused], repair genuine test/type/lint failures; squash to existing stable Preview only after focused green. Canonical CI + exact-SHA trusted Vercel READY are required before claiming a user-testable deployment.
- Manual Windows/macOS keyboard, WebKit/Android PWA and screen reader tests are not performed; request user acceptance on Preview. No `dev`, `main`, or Production promotion without explicit approval. Issue #956 remains open for later broader app-surface keyboard navigation.
