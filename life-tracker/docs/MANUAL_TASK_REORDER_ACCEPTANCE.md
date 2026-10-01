# Manual mobile acceptance: task reordering

Run on touch hardware in both the contained Day View sheet and inline Todo Day View.

1. Tap, double-tap, triple-tap, check, edit, open memo/image/reactions, and vertically scroll from the task title/content. Confirm each existing action still works and ordinary scrolling never begins reordering.
2. Touch and drag only the task's reorder grip. Confirm the row lifts immediately, the overlay follows the finger, and starting on the title/content instead keeps normal tap/scroll behavior.
3. Reorder to the first and last slot, within a category, across categories, and into an empty category. Repeat with the destination collapsed; its saved collapse preference must not change.
4. Drag near both scroller edges. Confirm one smooth bounded auto-scroll operates in the sheet scroller and in the page scroller, then stops immediately after release/cancellation.
5. Confirm the Day View Swiper, outer person carousel, page scroll, and sheet dismiss gesture remain usable outside the grip and do not take over after a grip drag starts. Only the visible slide may start a drag.
6. Cancel using pointer cancellation, day navigation, sheet dismissal, and interrupted capture. Delete the dragged task from a second client during a drag. Confirm no reorder commits and no row jumps under the pointer.
7. Confirm sorting is unavailable in friend view, selection mode, title editing, while an add row is pending, and while task action sheets are open.
8. Reorder offline, reconnect, and verify the order syncs. Then reorder the same group rapidly and from two clients; confirm the latest completed local gesture wins locally and every client converges to a deterministic order.
9. Enable reduced motion and repeat a cross-category move; confirm placement remains understandable without large motion.

Record device/OS/browser, viewport, mode, and any failed step with a screen recording.
