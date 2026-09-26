# Session checkpoint

Updated: 2026-09-26

Current task: fix the fast Month/Week CalendarView regression where repeated swipes can outrun the mounted render window and expose an empty geometry slide ("swiping into the void") on `perf/calendar-swipe-settling`.

Status: root cause is confirmed. The previous perf follow-up kept the expensive Calendar render window completely pinned to the last settled index while `focusDate` continued advancing on Embla `select`. Idle prewarming to ±2 only hid the problem for the first couple of rapid swipes; a third selection before `settle` could move to index 33 while the mounted range was still 28–32. That empty slide behavior did not exist on `dev`, where selection always contributed to the render bounds.

The repair keeps the useful perf idea without violating the original no-void behavior: retain the settled/prewarmed window during animation, but extend the selected edge by one neighbor whenever `focusDate` advances. This makes the in-flight window a temporary union rather than a pinned window. Nothing is removed from the old settled side until `settle`, and every newly selected slide plus its next immediate swipe target is mounted. The active person's idle ±2 prewarm remains; inactive panes remain bounded.

## Working set
- `life-tracker/src/components/home/views/useCalendarState.ts`
- `life-tracker/tests/react/useCalendarState.test.tsx`
- `life-tracker/tests/e2e/interaction-contract.spec.mjs`
- `life-tracker/docs/PROJECT_REFERENCE.md`
- `life-tracker/docs/SESSION_STATE.md`

## Completed substeps
- Compared current perf behavior directly with pre-perf `dev`; confirmed the regression was introduced by masking `focusIndex` out of render bounds while a swipe was in flight.
- Added a deterministic regression covering three rapid `select` events before any `settle`.
- Behavioral red: Quality Gate run 716 failed because selected index 33 required mounted content through index 34, while the perf branch remained capped at renderEnd 32.
- Removed the in-flight focus masking. The settled/prewarmed side remains mounted, while the newest selected `focusIndex` contributes only its ±1 window.
- Focused Quality Gate run 717 passed.
- Added a browser contract that performs three consecutive Calendar swipes and requires the newly selected month grid to remain mounted after each selection.
- Updated PROJECT_REFERENCE.md §16 so the no-empty-slide union behavior is durable and future perf work cannot reintroduce the regression.

## Constraints
- Preserve direct-manipulation Month/Week swiping and original pre-perf behavior: rapid repeated swipes must never reveal an empty Calendar slide.
- Preserve the first perf win where possible: do not shift/unmount the settled side during the snap, do not add per-frame `scroll` React state, and keep inactive/cold rendering bounded.
- Keep `skipSnaps: false`; do not change gesture semantics as a shortcut.
- Do not merge this perf branch into `dev` without explicit user instruction.

## Verification
- Behavioral red: run 716 — third rapid selection advanced past the mounted renderEnd.
- Focused implementation green: run 717.
- Browser contract with three repeated swipes: run 718 pending/completing.
- Exact final canonical full acceptance: pending after this documentation checkpoint.
- Stable `perf/calendar-swipe-settling` Quality Gate + Vercel Preview: pending delivery.
- Real-device Month/Week acceptance: pending on the updated stable Preview.

Next action: confirm the browser regression, run canonical full acceptance on the exact final task SHA, squash-merge into `perf/calendar-swipe-settling`, verify stable CI/Vercel, then hand the same Preview back for a rapid-swipe device check.

Blockers: none.
