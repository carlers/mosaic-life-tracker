# Manual mobile acceptance: task reordering

Run this on the stable Preview using a real touch device, with at least two populated categories and one empty or collapsed category.

1. Open Day View before touching any task. Every stored task must immediately show its title/content and be tappable; there must be no blank/dark task shells.
2. Close Day View and reopen the same day without reloading the app. Every task must still be visible exactly once, and tapping a title must open its task action sheet.
3. Start a normal vertical swipe on a task title and move before the half-second hold completes. The page/sheet must scroll normally and no task may lift.
4. Press and hold the task title without moving for about 500 ms. A full neutral-background overlay must lift under the finger with no visible grip or jump. No source task may disappear permanently.
5. Move the finger up/down through siblings and across categories. Siblings must react around the insertion gap; no title or control may turn into an inert dark shell.
6. Release between siblings in the same category, then into a different populated category. Each task must settle into the exact opening once and persist after close/reopen and reload/sync.
7. Drag into an empty category, then a collapsed category by dropping on its visible category surface/header. The task must append without hover auto-expand.
8. Without closing/reloading, perform at least five consecutive moves: cross-category, another cross-category, same-category, populated → empty, and back again. After every release every task must remain visible exactly once, tapping must still open actions, and the next long-press must activate.
9. Cancel an active drag, then close and reopen Day View. Original placement must remain and the fresh opening must contain no dead/inert rows.
10. Repeat first ↔ last moves and a move where the source category becomes empty. No duplicate/missing tasks.
11. In the full Day View sheet, repeat same/cross-category drags. Once lifted, Swiper and sheet-dismiss must not steal the drag; before lift ordinary scrolling/day gestures remain usable.
12. Confirm single-tap actions, double-tap title edit, triple-tap memo edit, checkbox, memo, image, reactions, selection mode, add-task mode, and inline title editing still work.
13. Repeat in inline Todo Day View and with reduced motion enabled.

Record device/OS/browser and any failed step with a short screen recording.
