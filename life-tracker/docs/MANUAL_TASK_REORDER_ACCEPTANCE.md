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

## v0.119.7 branch-only Preview delivery fallback

The protected trusted Preview artifact receiver currently refuses a mixed-attempt
CI artifact, and its privileged writer is disabled on the current default branch.
This Preview therefore explicitly restores the documented Git-first fallback for
**only** `feature/1867-diary-header-drop-v01197-20261121` via its own
`vercel.json` rule; all other feature, task, dev and main rules are unchanged.
Require new exact-SHA full canonical CI SUCCESS and independently verified Vercel
READY Git source / Preview Appwrite project before sharing a test URL. Do not
present trusted receiver success as proof of a provider deployment or bypass
failed CI. No Preview → dev or Production promotion.

## Diary group drag-release target stability — v0.119.7 (#1867)

Regression: Drag a multi-entry day group from its second position to its
fifth position among mixed-height tasks (repeat 10+ times with slow and rapid
pointer-up). The compact insertion gap and surrounding rows must agree with
where the **full group actually settles**, even when the gap covers the
underlying droppable at release. Verify it persists after close/reopen/reload.

Also release while hovering over the gap, a task half, a category header,
and the day top/bottom boundaries; the group must not jump back to its
previous slot. Escape/cancel and release outside the day workspace must
restore the original placement instead of saving a stale hover. Try long
within-target movement without changing insertion target, quick successive
drags, touch/trackpad/mouse, auto-scroll, reduced motion, and offline local
settings; no duplicate group or loss of expanded entries.

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
   with all entries, per-entry expansion state, previously loaded entry count,
   sort preference and buttons preserved. Surrounding tasks should settle smoothly with no duplicate rows,
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


## Diary Notes v0.130.2 drag performance and layering (#2298)

On the exact-source feature Preview, test mouse/trackpad and a touch device with 30–100 tasks spread across multiple categories, 30+ grouped diary entries, multiple distributed notes sharing a task gap, and mixed short/long tasks with photos.

1. Drag a grouped diary entry repeatedly while hovering within its group. The carried preview should follow the pointer without delayed frames; original content must not move above any category pill. Keep the pointer still near a category boundary and verify there is no oscillation.
2. Extract a grouped entry into an empty, populated, and collapsed category. The only insertion preview must appear **below** its category pill, and a collapsed destination must show a compact drop indicator without silently expanding. Drop, reopen and verify the correct category and order.
3. Reorder distributed notes across tasks and other distributed notes (first↔last, 2+ notes in one gap), then drag tasks through those notes. Both task order and independent note order must remain stable and persist after reload.
4. Drag back into the grouped diary container; cancel an active drag, release outside the day workspace, and drag the same item again. There must be no leftover overlay, duplicate slot, hidden source or unintentional save.
5. Scroll the **Home page itself** and the inner Day View panel while dragging, then drop on a valid category. The hit target must follow the actual visible layout, not a stale screen coordinate; the parent header and neighboring pills must remain on their own rows.
6. Repeat with reduced motion, category collapse, touch scroll before the 450–500ms hold, rapid consecutive drags, a sorted-task mode, a recently deleted/retired category, and a day with only one task/diary entry.
7. With a dense day, inspect the gap response while dragging tasks at the top, middle and bottom. Source/destination rows should respond without cumulative frame drops; use real-device performance traces if frames still drop. Browser/unit CI cannot prove 60 FPS or absence of visual overlap on a specific device.

## Diary Notes v0.130.3 mixed-boundary and release-gap continuity (#2298)

Test with **two populated categories**, notes above the first task and below the last
task, two or more notes between consecutive tasks, and a grouped Diary container.
Perform on touch and desktop pointer. These are visual-performance acceptance
checks, independent of successful automated tests.

1. Drag a note directly below a category pill, and drag the last note toward
   the next category pill. Hold at the 16px inter-category margin: the
   insertion target must remain stable, never briefly disappear or jump into
   the wrong category. Repeat first/last positions with notes and tasks mixed.
2. While hovering at any category's first/last position, release and watch the
   next 250ms in slow motion. There must be one uninterrupted full-height
   space that is gradually occupied by the arriving note; the space must
   **never collapse to zero and expand again**. The carried overlay must land
   on that reserved position and the final note size must not snap the header.
3. Take an individual entry out of the bulk Diary group and move it back
   repeatedly, including the same group boundary and a neighboring category.
   The group must release its source row height upon exit, restore that slot
   upon re-entry, and never trap the hover over space that no longer belongs
   to it. Test a single-entry group as well as 30+ grouped entries.
4. Drag a task across a note in a populated category, release, and repeat
   before settings/task subscriptions finish. Task/Diary order must remain
   visually stable rather than reverting to old positions for one or more frames.
5. Repeat with zero-task categories, collapsed destinations, very tall entries,
   quick reverse drags, releasing outside/canceling, Home window scroll vs
   Day sheet inner scroll, reduced motion, offline write then reload, and
   multiple devices. Check every note/task exists exactly once after reopening.
6. Measure device frame times rather than treating a successful CI/build as
   proof of a stable 60 FPS; capture the exact first/last geometry if a
   flicker or overlap remains.

## Diary Notes v0.130.4 — task-parity sticky slots and wallpaper glass (#2298)

1. **Pickup with task/Diary mix:** Start a note drag from directly above or below
   the first task under a category pill. The note's original slot must be
   reserved from the first painted drag frame, the same as a task.
2. **Pill and neutral-zone crossings:** Move a note very slowly across the
   category pill and the whitespace between two categories, then reverse
   direction repeatedly. The last valid full-height insertion gap must never
   collapse during a momentary lost collision; the Day View height must not
   oscillate. Cross into the next category while its first item is a task.
   The gap must appear before that task, not teleport below it.
3. **Actual row midpoint:** Hover the upper and lower halves of that first
   task, then move back over its header. Before/after ordering should be
   deterministic even when inserting a note in the preceding category shifts
   the next pill down a full note height. Repeat with the first item a note,
   final item a task, empty categories and a collapsed category.
4. **Release/cancel:** Drop on a pill or in an adjacent valid gap, then check
   that the reserved space remains until the floating note finishes settling.
   Cancel outside the workspace and verify the note is not silently saved
   into its previous hover target. Check no duplicate or missing entry after
   closing/reopening and after offline-to-online reconciliation.
5. **Grouped Diary material:** With a wallpaper and responsive glass enabled,
   verify the *one* grouped Diary container becomes the existing translucent
   frosted panel, without independent per-entry blur layers. Wallpaper off
   retains opaque original styling. Check Light, Dark, Black, reduced
   transparency/contrast, and performance on a low-end touch device.
6. **Sustained performance:** Test 100+ mixed rows, touch long-press, rapid
   reversals, scrolling with the pointer held, and the boundary between the
   bulk grouped Diary container and a first-task category. Automated CI cannot
   establish actual mobile frame pacing.

## Diary Notes v0.130.5 — first/last row drop invariants (#2298)

1. With two neighboring categories containing **interleaved tasks and diary entries**,
   drag the **first note to the last position** and **last note to the first**
   within a category; then repeat across categories. Include a category whose
   first item is a task and one whose last item is a note. The *actual saved
   order* must match the last visible full-height insertion gap.
2. Hover a note immediately before the first task of the next category,
   **stop moving the pointer**, and release. Even if the insertion gap has
   pushed that task or its category pill underneath the stationary pointer,
   release must not change the target to after the task or into the
   neighboring category. Repeat at the bottom boundary.
3. Move slowly across the first/last note's own insertion gap and over the
   whitespace between category headers. The ghost gap must not intercept
   pointer collision or cause targeting to chatter without deliberate movement.
4. While a ghost is at the top/bottom, move to another row decisively, then
   release: the *new* target must win, not an obsolete retained position.
   Drag into the Diary group, drag back out, and cancel outside the workspace.
5. Repeat with 0, 1, 30 and 100+ mixed rows, collapsed/empty categories,
   multiline notes, scrolling, touch/mouse/trackpad, reduced motion and
   Light/Dark/Black. Reopen and reload offline/online to confirm no duplicate,
   missing or reverted entries. Record any remaining failures with a screen
   recording showing the exact drop gap and final order.

## Diary Notes v0.130.6 — stable pointer ownership and frame pacing (#2298)

1. Start with a diary entry **immediately below a task**. Long-press it,
   drag upward past the task's midpoint, stop above the task, and release.
   The entry must remain under the mouse/finger throughout and persist **above**
   the task after reopening and reloading. Reverse the move, then repeat
   rapidly ten times without restarting Day View.
2. Repeat on a first/last row, across category pills, with multiple diary
   entries between tasks and with a bulk Diary entry. Pointer capture must
   not be lost when React moves the original row around the insertion gap.
3. A normal vertical swipe that starts before the 450 ms long-press must
   scroll rather than lift a note. Long-press and release outside the
   category workspace must not save an incorrect position.
4. On a day with 100+ mixed rows, drag rapidly across many task boundaries,
   reverse direction repeatedly and record a phone video/trace if frame
   drops remain. Pointer collision updates should be coalesced to at most
   once per animation frame and unaffected Diary rows should not re-render
   just because the hover gap changed.
5. Recheck entry tap, double-tap edit, pointer cancel, scrolling/auto-scroll,
   group↔category movement, Light/Dark/Black and reduced motion. Manual
   smoothness cannot be established by CI alone.

## Diary Notes v0.130.7 — mixed drag frame pacing (#2298)

- Compare v0.130.6 and v0.130.7 on the *same* phone and laptop, using
  a day with 20, 100 and 200 interleaved tasks/Diary entries. Reorder rapidly
  through 10 adjacent tasks, first ↔ last, across category pills, into/out
  of the bulk Diary group, and over the first/last note in a task gap.
- Record a browser Performance trace or phone screen recording if any input
  lag, frame hitch, dropped placeholder, or delayed card movement remains.
  The carried card must follow the pointer directly while the full-height
  insertion gap persists and neighboring rows respond without bouncing.
- Check the first item of an empty/populated category and the final note
  directly beneath a task. Release with a stationary pointer and validate
  exact saved order after close/reopen and reload. Also test cancellation,
  reduced motion, offline sync, ordinary vertical scroll before long-press,
  and task-only reordering.
- Automated regressions assert that an indexed hover slot yields exactly
  the same rank/noteOrder as the authoritative persisted mixed-order
  projector for tasks, notes, category starts/ends and 100+ row fixtures;
  changed-hover rendering should not re-render unrelated categories.
  These checks alone do not establish real-device frame rate.
