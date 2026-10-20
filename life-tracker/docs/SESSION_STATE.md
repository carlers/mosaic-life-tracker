# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #856 — mobile held-pointer reliability and live cross-day task projection.

## Source, owner report and intent
- Owner confirms v0.34.4 generally works, but intermittent Android/iOS finger loss (~50% subjectively) still occurs without reliable reproduction. Unlike same-day reorder, entering a new day currently shows static tasks/categories under the overlay.
- Existing stable Preview: `feature/cross-day-drag-856-20261020@c0cfe61a935e1e641e2758c68e677d94e35faeb7` v0.34.4; full canonical Gate #39431907588 and exact-SHA Vercel READY. `dev@27c4725e382c8f57b6302c382fc4ece7f30d05b2` stays untouched.
- Task branch `chatgpt/856-touch-projection-20261020`; proposed PATCH v0.34.5.

## Investigation and change
- Task title deliberately has `touch-pan-y` for ordinary pre-lift scrolling. During *post*-long-press native touch movements, this may let browser scrolling steal the pointer, causing intermittent pointercancel / visible detachment. Add non-passive captured touchmove protection **only while a real dnd-kit owner drag is active** and single-finger. Record touch identifier, use TouchEvent coordinates to update stable carried overlay when pointer events/capture are inconsistent across Swiper source unmount; finish/cancel on genuine touchend/touchcancel and fail closed on multi-touch. Preserve scrolling before activation.
- The destination previously projected only a target date/category/index in state with no responsive list. Add neutral (no colored fill/border) height-reserving slot in target category, use motion layout to move sibling task rows and affected category sections, including empty/collapsed destinations, and remove the held task from source list during external carry. Gap has stable keyed identity and cursor hover hysteresis so feedback from shifted row midpoints does not oscillate.
- Clamp horizontal hit-testing into the active day at the same finger Y so holding beyond edge still picks the category under the finger. Keep actual final commit on release only; preserve diary/shared, keyboard/accessibility, read-only, owner isolation.
- E2E fixture `?crossDayDestinations=1` populates the next day with categories/rows. Browser touch contract checks neutral gap moving among rows and categories without stale colored indicators, plus earlier repeated-swipes/overlay tests.

## Delivery/verification
- Run focused + browser contract CI for task branch. Repair failures; then stable Preview squash, full canonical CI, exact-SHA Vercel READY, issue checkpoint.
- Actual iOS/Android finger tracking and prolonged >87-day rebase, offline sync and release persistence require owner device acceptance. Keep issue open. No approval for dev/main/Production/backend changes.
