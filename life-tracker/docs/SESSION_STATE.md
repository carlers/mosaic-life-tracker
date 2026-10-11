# Session checkpoint

Updated: 2026-10-12 UTC
Current task: Mosaic #640, persistent first Calendar → Day View sheet delay after refresh even when Home idles for one minute.

## Live verified basis
- v0.17.9 stable Preview `perf/day-view-idle-warmup-20261011` @ `9d6b631f6a7ce57809e0430d96b44ebae39b4579` is Vercel READY at `https://mosaic-life-tracker-git-perf-day-38751e-carls-projects-72516fde.vercel.app`; user reports first tap still slow but later opens instant. No dev/main promotion authorized.
- Earlier synthetic Chromium probe (not real device): 181 physical Swiper slides reduced to ~9 Virtual DOM slides; longest 50-task first-open main-thread task 235→82ms. This did not establish tap-to-first-visible-sheet latency. Prior module warmup and two-frame content defer alone had also failed user acceptance.
- Real-path source review: `CalendarBody` lazily mounts the entire `DayViewSheet` after a day-cell click. The old `BottomSheet` only deferred child reconciliation; `DayViewSheet` data hooks and JSX slide construction still ran before the shell could paint.

## Candidate implementation
- `chatgpt/day-view-first-paint-20261012`, v0.19.3, based on accepted stable Preview. Split lightweight `BottomSheet` outer host from `DayViewSheetInner`, so the existing two-frame portal-content delay defers cold hook/Swiper/task initialization until after the shell can paint. Forward close/reset, settled animation, horizontal gestures, select-to-dismiss and nested/reorder lock controls; leave inline/backlog behavior unchanged.
- Added actual `CalendarBody → DayCell → lazy DayViewSheet` browser harness, opt-in timeline and shell-before-slides browser ordering regression; the old isolated-button perf probe remains diagnostic only. No backend/Appwrite changes.
- Local verification: TypeScript passes, ESLint 0 new errors (three pre-existing warnings), 460 DOM tests pass, production build and all seven size budgets pass, version and project contracts pass.
- Task commit `8da8a66329e0a5b6b2ac5ae0dd3729b13acf5a50`: GitHub browser shards 1/2 and 2/2 passed, focused failed ONLY because this checkpoint breached the documentation handoff size limit (3082/3000 estimated tokens). Condense checkpoint and rerun focused CI without changing behavior.

## Next action / guardrails
1. Confirm repaired task focused CI success, squash task PR to the stable `perf/**` Preview, and verify exact-source full canonical Quality Gate and Vercel Scratch READY alias. Do not bump again for internal repair.
2. Ask user to verify v0.19.3 on affected device after hard reload, first click immediately and after idle, reopen, rapid swipes, far date jump, close/back/focus. Never imply browser diagnostics equal device acceptance.
3. Keep #640 open and do not promote dev/main without explicit approval; reconcile intervening dev commits and version at promotion.
