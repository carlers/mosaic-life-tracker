# Manual mobile acceptance: task reordering

Run this on the stable Preview using a real touch device, with at least three tasks in one category.

1. Start a normal vertical swipe on a task title and move before the half-second hold completes. The page/sheet must scroll normally and no task may lift.
2. Press and hold the task title without moving for about 500 ms. The same full TaskItem must lift at its existing position with no visible grip and no jump. Its floating background is the normal Mosaic background, not the category color.
3. Move the finger up and down through sibling tasks. The lifted task must stay glued to the finger. Every sibling remains visible and smoothly moves aside as the insertion point changes; nothing disappears or gets reconstructed.
4. Release between two siblings. The lifted task settles into that exact opening once, with no second snap-back, and the new order remains after closing/reopening Day View and after reload/sync.
5. Repeat upward and downward moves, including first ↔ last position. Reordering must stay inside the same category; crossing another category must not transfer the task in this version.
6. In the full Day View sheet, repeat the drag. Once the task lifts, the day Swiper and sheet-dismiss gesture must not steal the drag or change/dismiss the day. Before lift, ordinary scrolling and day gestures remain usable.
7. Confirm task single-tap actions, double-tap title edit, triple-tap memo edit, checkbox, memo, image, reactions, selection mode, add-task mode, and inline title editing still behave normally. Sorting must not start while selection/edit/add state disables it.
8. Repeat in the inline Todo Day View and with reduced-motion enabled.

Record device/OS/browser and any failed step with a short screen recording.
