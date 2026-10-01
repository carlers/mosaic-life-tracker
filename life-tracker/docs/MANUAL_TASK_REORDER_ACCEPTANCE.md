# Manual mobile acceptance: task reordering

Run on touch hardware in both the contained Day View sheet and inline Todo Day View.

1. Tap, double-tap, triple-tap, check, edit, open memo/image/reactions, and vertically scroll from the task title/content. Confirm each existing action still works and ordinary scrolling never begins reordering.
2. Press and hold a task title for about half a second without moving. Confirm there is no visible reorder grip, the task lifts only after the hold threshold, and moving vertically before the threshold scrolls instead of reordering.
3. After lift, drag the task. Confirm every non-dragged task remains visible, the source TaskItem stays mounted in its original category, the overlay follows the finger, and the projected gap moves without the list disappearing.
4. Reorder to the first and last slot, within a category, across categories, and into an empty category. Repeat with the destination collapsed; its saved collapse preference must not change.
5. Drag near both scroller edges. Confirm one smooth bounded auto-scroll operates in the sheet scroller and in the page scroller, then stops immediately after release/cancellation.
6. Confirm the Day View Swiper, outer person carousel, page scroll, and sheet dismiss gesture remain usable before long-press activation and do not take over after a task drag starts. Only the visible slide may start a drag.
7. Cancel using native touch cancellation, day navigation, sheet dismissal attempts, and interrupted capture. Delete the dragged task from a second client during a drag. Confirm no reorder commits and no unrelated row disappears or jumps under the pointer.
8. Confirm sorting is unavailable in friend view, selection mode, title editing, while an add row is pending, and while task action sheets are open.
9. Reorder offline, reconnect, and verify the order syncs. Then reorder the same group rapidly and from two clients; confirm the latest completed local gesture wins locally and every client converges to a deterministic order.
10. Enable reduced motion and repeat a cross-category move; confirm placement remains understandable without large motion.

Record device/OS/browser, viewport, mode, and any failed step with a screen recording.
