# Manual mobile acceptance: task reordering

Run on touch hardware in both the contained Day View sheet and inline Todo Day View.

1. Tap, double-tap, triple-tap, check, edit, open memo/image/reactions, and vertically scroll from a task. Confirm each existing action still works and ordinary scrolling never lifts a row.
2. Hold the task title for roughly half a second without moving. Confirm pressed feedback appears only after the threshold, the row stays above siblings, and releasing before the threshold does nothing.
3. Reorder to the first and last slot, within a category, across categories, and into an empty category. Repeat with the destination collapsed; its saved collapse preference must not change.
4. Drag near both scroller edges. Confirm one smooth bounded auto-scroll operates in the sheet scroller and in the page scroller, then stops immediately after release/cancellation.
5. Confirm the Day View Swiper, outer person carousel, page scroll, and sheet dismiss gesture remain usable before activation and do not take over after a row is lifted. Only the visible slide may start a drag.
   On a real touch device, deliberately add a small horizontal movement after the 450 ms activation. Verify the task overlay follows the finger while the Day View date, enclosing Todo/person carousel, and BottomSheet all remain completely stationary; release and repeat in both sheet and inline modes.
6. Cancel using pointer cancellation, day navigation, sheet dismissal, and interrupted capture. Delete the dragged task from a second client during a drag. Confirm no reorder commits and no row jumps under the pointer.
7. Confirm sorting is unavailable in friend view, selection mode, title editing, while an add row is pending, and while task action sheets are open.
8. With a keyboard, lift using Space, move with arrow keys, drop with Space/Enter, and cancel with Escape; verify screen-reader announcements describe lift, position/category changes, drop, and cancellation.
9. Reorder offline, reconnect, and verify the order syncs. Then reorder the same group rapidly and from two clients; confirm the latest completed local gesture wins locally and every client converges to a deterministic order.
10. Enable reduced motion and repeat a cross-category move; confirm placement remains understandable without large motion.

Record device/OS/browser, viewport, mode, and any failed step with a screen recording.
