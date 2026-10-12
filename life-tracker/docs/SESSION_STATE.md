# Session checkpoint

Updated: 2026-10-12
Current task: #692 — optional mobile Calendar zoom, 3/4/7 visible weekdays.
Baseline: dev@dbde9515ecb611082f191d39e5ef71cfcecde3bc, v0.20.5.
Task: chatgpt/692-calendar-zoom-20261012.
Proposed Preview version: v0.23.0 (v0.21.0 #404 and v0.22.0 #408 are concurrent feature candidates; verify against other active Previews before promotion).

## Goal and scope
- Account-synced Preferences → Calendar mobile zoom 7 (default), 4 or 3 days, validated fallback.
- In owner/friend Home Calendar, narrow measured content widths activate one native x-scroll viewport containing weekday headings plus all seven daily columns for every month/week row. Weekday offset is shared across adjacent month/week slides; default seven-day mode remains unchanged.
- Keep existing month arrows; title swipe opt-in only, grid x wheel/pan yields from Embla/trackpad parent; keyboard arrows move focus among day buttons and reveal hidden weekdays.
- Preserve app vertical scroll, all normal date/task/holiday semantics, Day View lazy first-open performance, outer person/route gestures and browser pinch zoom.
- No Appwrite schema, Function or Production changes. #404 stays on separate accepted stable Preview, not merged to dev/main.

## Verification and delivery
Next action: run focused CI on a complete task [verify:focused] commit; repair failures; squash into distinct stable Preview; verify exact-SHA canonical, seven size limits, PWA, Vercel READY, and real-browser gesture checks.
- Manual acceptance remains required on iOS Safari/PWA, Android Chrome, landscape and desktop trackpad; do not imply they were performed by automated CI.
- No dev/main promotion without explicit user authorization.
- After #404 and #692 acceptance, reconcile overlapping calendar files on a dedicated integration task branch and rerun complete gates before any joint promotion.

## Stable Preview first canonical evidence
- Stable feature/calendar-zoom-692-20261012@bd943e6050c8ba259b29a9526d50c64ba3ffc196: focused task passed; canonical checks/DOM/browser/dependency passed but build guard failed on four measures. Exact GIPHY Vercel Scratch build dpl_ENfiJ68sh1BnmM7cYLSP59d8Kz9r compiled and passed PWA, but Vercel status ERROR due to guarded asset sizes.
- Measured candidate: initial 146033/146050 pass; Home 366975/366100 fail, app raw 2464543/2461000 fail, gzip 765061/764000 fail, precache 2551850/2548500 fail. The latest repair task chatgpt/692-zoom-preview-size-and-gesture-20261012 documents metric-specific proposed allowances, preserving entry/initial limits.
- Also cover title-swipe suppression clearing after a touch pan that emitted no click. Run focused tests and exact stable Preview full/hosted gate after approved squash; no dev/main merge.

## #692 v0.23.1 user-accepted refinement (2026-10-12)
- User reports sluggish native horizontal drag and asks for smooth 3/4-day release snap, outward edge handoff to previous/next month or week, and cursor drag on narrow desktop. #692 comment 6122777268 records approved acceptance and probable scroll-event feedback cause.
- Base stable Preview `feature/calendar-zoom-692-20261012@fa8110e` v0.23.0. New task `chatgpt/692-smooth-snap-edge-20261012` candidate version 0.23.1; do not change dev/main or concurrent #404/#408 branches.
- Replace per-scroll writes to all mounted adjacent zoom lanes with O(1) offset tracking; align other slides only after render-window month navigation. Native browser x touch scroll retains 1:1 finger movement, CSS native block snap uses page offsets 0/3/4 for 3 visible days and 0/3 for 4 visible days (clamped edge). Separate intentional outward edge gestures for touch/mouse/wheel invoke existing calendar prev/next. Mouse cursor drag threshold suppresses post-drag date click only, and permits normal tap/click.
- Focused task CI, then stable Preview squash and exact-SHA full canonical plus Scratch/GIPHY Vercel and all size budgets. Record any measured budget review rather than bypass. Device gesture acceptance still human-pending.
Next action: run focused CI on complete task checkpoint [verify:focused], investigate failures before stable Preview; no dev/main merge.
