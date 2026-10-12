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

## Diary and mixed-height drag acceptance (#408)

In the v0.25.3 Scratch Preview, enable **Show diary in Day View** and use both
Compact and Expanded diary block-height settings, including a multiline entry
with emoji and photos.

1. Long-press each diary block for 500ms. The **actual full diary card** follows
   the pointer/finger with its rendered height, content, emoji and photos. There
   must be no generic "Diary entry" chip and no faded visible original.
2. Drag over the first/last boundary and before/after tasks in short, tall, empty,
   and collapsed categories. Neighboring blocks glide to accommodate the
   insertion space *during* hover, not just on pointer release. The carried card
   must follow the finger without easing/lag.
3. Release in a valid location, outside the list, and cancel with Escape/pointer
   cancellation. Every diary/task block is fully visible and tappable afterward.
   Reorder the same items several times without a refresh.
4. Repeat with a normal short/long task, and with cross-category task drops.
   Verify task titles, category assignment, ordering and diary placement
   persist after close/reopen and reload.
5. Repeat in Calendar Day View and Todo inline Day View, on mouse, real touch
   device and trackpad. Verify scrolling before long-press, auto-scroll while
   dragging, category collapse, reduced-motion and rapid day/account switches.
6. Recheck diary single-tap read and double-tap edit; reply/reaction/social
   workflows are out of scope for this frontend-only change.

Manual/device acceptance is separate from automated test success. Record the
device/browser and a short capture for any remaining reflow or visibility defect.

## v0.25.3 release-settling and diary parity checks (#408)

- With both Compact and multiline Expanded diary entries, hold for 500ms. The *real entire card* should lift with the pointer. The original list position must immediately become the **single** insertion gap, with no second placeholder left behind.
- Move diary first/middle/last across populated, empty, and collapsed categories. Watch neighboring tasks while holding still over each destination: they should yield exactly one card-height gap like a task drag, never jump back as the finger stays still.
- Release diary and a similarly tall task, both within and across categories. Watch the first 250ms after release: neither the carried item nor nearby siblings should fly up to the original slot, bounce downward, or disappear before settling.
- Repeat outside/canceled drops, rapid alternating task/diary moves, and saved placement after reload on touch and desktop. Record a slow-motion capture if release still jumps.

## v0.25.4 live drag-feedback polish — acceptance on real devices

- **Bottom-to-top task drag:** long-press the bottom task in a populated category and move slowly upward past multiple tasks. Exactly one full task should follow the finger, with no faded/overlapping duplicate under the following category pill; there should be one insertion gap, while siblings animate.
- **Diary tracks the finger:** use both Compact and Expanded entries with long multiline text, emoji, and attached photos. Long press; the visible full-height card should stay under the finger throughout horizontal **and** vertical motion, including while targets move or scroll underneath it. It must not pop somewhere else or remain stationary while dragging.
- **Release parity:** task and diary should land without flying back and forth. Try top/bottom/same category/across categories, empty and collapsed categories, cancellation/outside drops, and 5 consecutive drags. Check no disappearing content, duplicate gaps, or saved-placement drift after reload.
- Verify independently on a touchscreen phone and desktop pointer/trackpad. Automated browser tests do not substitute for human inspection of rendering.
