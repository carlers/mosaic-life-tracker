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

## Timeline manual planner (#1854)

On exact-SHA Scratch Preview, use a real touch device in Calendar Day View and Todo inline Day View.

1. Switch to Timeline > Manual, with sections Off/3/6. Verify every dated owned task appears exactly once and preserves category labels; Diary and accepted shared tasks are also accessible in Timeline when permitted and enabled.
2. Hold a title for ~500 ms and drag within each section, into a populated or empty section, to the first and last positions, and out of Unassigned. Confirm overlay follows the finger without a ghost source; scrolling remains normal before activation.
3. Switch between Off, 3 and 6 sections. Early/late assignments are retained without rewriting category order; completing and reopening tasks do not move them.
4. Change a task's section from Task Actions and add a new task from a section header; reopening the day shows the saved placement on both devices.
5. Repeat 10 consecutive drags, cancel mid-gesture, navigate dates and switch account; no missing/duplicate tasks, dead rows or cross-account data.
6. Test category/completion filters, selection, inline editing, checkboxes, keyboard navigation, BottomSheet scroll, reduced motion, light/dark/black, and narrow/wide layouts. Filters disable ambiguous drag operations.
7. Test offline reorder then restart and reconnect; verify exact order and owner-private settings converge. On two concurrent devices, validate stale settings CAS conflict handling rather than assuming a winning write.

### Timeline v0.92.1 visual and gesture acceptance

- Verify the options read **Off**, **Day and Night**, **Morning, Afternoon, Night**, and **Early and Late Morning, Afternoon, Night**. Switch all four modes on a day containing early-morning, late-afternoon, and late-night placements; no task disappears or changes its saved section.
- Assign a new task to the broad **Day** section in Day and Night mode; on more detailed modes it displays under Afternoon without rewriting its stored Day assignment.
- Check every task category label in automatic and Manual Timeline modes matches a smaller version of the normal Categories header pill: colored text, visibility icon, rounded black/light-theme adaptive background, no add icon or white border.
- Confirm all Timeline task separator borders and empty-section dashed outlines are gone; when hovering over an empty section during drag the destination can still be seen without a permanent outline.
- Long-press at least the title, category chip, blank card space, checkbox and photo area. Drag as surrounding tasks animate into projected positions **before** release. Test both same-section and cross-section moves, upward/downward motion, scrolling, canceled gestures, normal taps and swipe ownership.

## Collapsible header-only diary group drag — v0.119.6 (#1867)

This supersedes the **full-group floating visual** in v0.119.5 above.
The change applies to the whole diary-day group within tasks/categories;
individual diary-entry reordering and single-entry cards are separate.

1. With **3, 7, 15 and 30+ entries**, long-press the group count header.
   The carried visual should show **only the count header** (e.g., “7 diary entries”),
   without entry bodies, sort controls, emoji selectors or duplicate input fields.
   The group should yield its former entry height to surrounding tasks and
   categories immediately and smoothly; there must be no blank full-group-height
   hole or oversized ghost gap.
2. While holding, drag in both directions through mixed-height tasks, before/after
   categories, collapsed/empty categories, and top/bottom boundaries. The
   insertion gap should be only header height and follow the pointer without
   jitter, flashes or a delayed full-height container.
3. Release at the intended location. The **same full group** should expand again
   with all entries, per-entry expansion state, sort preference and buttons
   preserved. Surrounding tasks should settle smoothly with no duplicate rows,
   clicks, flickers or sudden reset to the previous location.
4. Repeat with one diary entry, and with 0 or 1 task; keep the existing single
   card gesture and ensure no phantom group header. Test Escape, pointer-cancel,
   outside release and day/sheet navigation during drag: restore the full group
   and original position without committing a stale hover.
5. Test normal tap/edit, individual-entry drag, account switches, mouse,
   trackpad, touch, scrolling, reduced motion and Light/Dark/Black. Check
   persistence after Day View reopen and reload. Record device/browser results;
   browser/CI evidence does not replace physical-device inspection.

## Entire diary-day container drag performance — v0.119.5 (#1867)

This is the **bulk diary-day container among tasks/categories**, not the
single-entry reordering below. Test with both one entry and three or more
expanded entries on a day. Begin by holding the **diary group header** (rather
than an individual entry, which owns its own long-press gesture).

1. On pickup, the floating card must reproduce the **complete already-rendered
   diary group** (header, all visible entries and their expansion state),
   not just its first entry or a generic diary chip. The original moves out
   of flow; only **one** projected insertion gap should exist.
2. Slowly drag the group through short/tall task rows, first/last positions,
   empty/collapsed categories, and outside the categories to the top/bottom
   boundaries. Neighboring tasks and category sections should yield smoothly
   *while dragging*, without repeatedly jumping between adjacent gaps when
   holding the pointer almost still.
3. Repeat with 1, 3 and 15+ same-day diary entries, compact/expanded mode,
   mouse/trackpad, real touch, and reduced animations. Compare cursor/finger
   tracking with task drag, including when the Day View sheet scrolls.
4. Reverse direction and cancel with Escape or pointer cancellation; nothing
   persists. Drop and confirm the saved placement survives closing/reopening,
   reload, and subsequent task moves. Verify no duplicate content, flashes,
   inert controls, unexpected diary opening, or content reloading while carried.
5. Tap to read/edit and reorder individual same-day entries after bulk drag.
   Their own long-press handler remains separate from the diary-group header
   drag. Friend view is read-only; do not use private production diary data
   for tests.

The overlay is a single inert DOM snapshot created at pickup, not a second
live diary editor/settings tree. Collision targets may update more than once
per pointer frame; only the latest hover projection is rendered per paint.
Manual device observation is still required to validate perceived smoothness.

## Intra-day diary entry live reflow — v0.119.3 (#1867)

This is the **order of individual entries within one diary day**, distinct from dragging
the entire Diary day group among tasks in Timeline. Test against the actual
owner's official Appwrite Preview, with disposable entries and at least three
independent records on the same date: a short entry, a multiline expanded
entry, and an emoji-bearing entry.

1. Select **Oldest first** and long-press **anywhere on the first diary
   entry card** for roughly 450 ms (including its text, empty padding, caret,
   Edit button and multiline body). There must be **no grip icon**. The whole
   card lifts with the pointer and other entries respond before release.
   A quick tap still reads, expands or edits; ordinary vertical scrolling
   and horizontal day swipes before activation must not start dragging.
2. Carry the first card across the second card's midpoint and hold. The second
   card should slide **up by the lifted card's full height plus the row gap**,
   creating one insertion space while the held card tracks the pointer
   immediately (not eased or delayed). Continue across the third card; both
   siblings should yield without flashing, duplicates or changing entry content.
3. After pickup, keep holding for **several seconds** without releasing,
   then release. The card must not accidentally open or edit; the synthetic
   click guard expires only after release. A separate new tap must still
   read/edit normally.
4. Reverse direction **without releasing**. The third card should smoothly
   return when its midpoint is uncrossed; no bouncing, hover oscillation, or
   unstable insertion target. Release at the second position. The saved order
   must match the last hovered gap, and the mode must become **Manual**.
5. Drag the bottom card **upward** through both previous entries, including a
   tall expanded card. Check that peer displacement uses the dragged card's
   own height and does not expose an extra placeholder or overlap the carried
   card. Repeat first-to-last and last-to-first five times.
6. Start another drag and **cancel** it. Nothing should persist or be left
   displaced. Repeat after expanding/collapsing an entry and switching between
   **Manual**, **Newest first**, and **Oldest first**. Switching modes must not
   destroy the last manually saved arrangement; returning to Manual restores it.
7. Repeat using mouse, real touch, and keyboard reorder (focus the **Read
   diary entry** button; Space, arrows, Space or Escape; Enter reads normally),
   with the application reduced-animation preference and
   the OS reduced-motion setting. Reduced motion removes easing but keeps
   the same insertion logic. No day-view or sheet gesture may steal an active
   entry reorder.
8. Reload and verify order persistence and emoji marker selection. Repeat
   offline and after reconnection with **disposable** owner data. For many
   entries, use **Show more** and verify that hidden rows are not accidentally
   dragged; never test with real private journal content.

Record device, OS, browser and a short capture of a failed hover or settle.
DOM pointer-event tests verify geometry and persistence rules but do **not**
prove rendered animation smoothness on physical devices.
