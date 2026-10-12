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
