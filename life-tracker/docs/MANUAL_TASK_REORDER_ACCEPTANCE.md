# Manual mobile acceptance: task reordering

Run this on the stable Preview using a real touch device, with at least two populated categories and one empty or collapsed category.

1. Start a normal vertical swipe on a task title and move before the half-second hold completes. The page/sheet must scroll normally and no task may lift.
2. Press and hold the task title without moving for about 500 ms. The same full TaskItem must lift at its existing position with no visible grip and no jump. Its floating background is the normal Mosaic background, not the category color.
3. Move the finger up and down through sibling tasks. The lifted task must stay glued to the finger. Every sibling remains visible and reacts as the insertion point changes; nothing may disappear.
4. Release between two siblings in the same category. The task must settle into that opening once and remain there after reload/sync.
5. Drag a task into a different populated category and release between two tasks. The destination must open a slot; release must move the task into that position and remove it from the source.
6. Drag into an empty category, then into a collapsed category by dropping on its visible category surface/header. The task must append without requiring hover auto-expand.
7. Without closing or reloading Day View, perform at least three consecutive moves: populated → populated, another cross-category move, then a same-category reorder. After every release, every task must remain visible exactly once and the next long-press must activate normally.
8. Repeat cross-category moves where the source becomes empty, and first ↔ last insertions in both source and destination categories. No duplicate task may appear and no task may disappear.
9. Cancel an active drag (Escape where available, or a canceled touch sequence). The original category and order must remain unchanged.
10. In the full Day View sheet, repeat same- and cross-category drags. Once the task lifts, the day Swiper and sheet-dismiss gesture must not steal the drag or change/dismiss the day. Before lift, ordinary scrolling and day gestures remain usable.
11. Confirm task single-tap actions, double-tap title edit, triple-tap memo edit, checkbox, memo, image, reactions, selection mode, add-task mode, and inline title editing still behave normally. Sorting must not start while selection/edit/add state disables it.
12. Repeat in the inline Todo Day View and with reduced-motion enabled.

Record device/OS/browser and any failed step with a short screen recording.
