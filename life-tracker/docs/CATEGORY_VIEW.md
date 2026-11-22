# Category View — issue #2278

## Preview implementation checkpoint (2026-11-22)
Source baseline: dev@c52fd1832058d055d43fde257cd45b894dd57a6f (v0.125.1). Proposed independent Preview version v0.127.0; do not merge to dev/main without separate approval. Feature branch and exact CI/Preview status are tracked in issue #2278.

### Product contract
- Category View is the fourth owner-only Home view. Closed picker has icon and chevron; opening displays labeled Calendar, To-do List, Diary, Category View choices. Daily Review #1794 is not imported or approved.
- Category-scoped dated tasks: Today at the default anchor, past in newest/oldest order, upcoming in ascending order, explicit undated/invalid sections. All/completed/incomplete filters only project canonical owner tasks; never create separate task records.
- Inline quick add preselects category and Today, lets user change date, and retains input on save failure. Category lifecycle boundaries are checked by the existing domain hook. Account-synced sticky Add Task preference defaults true.
- Tapping a task opens the existing Task Action Sheet with existing memo, visibility, share, photo and task date editors. Checkbox uses the existing completion hook; tap/double-tap task edits reuse TaskItem.
- Mobile task left swipe reveals Move, Duplicate and confirm-delete; right swipe defaults off. Both directions expose Off/Reveal preference initially; full configurable direct-action bindings are gated follow-up. Header category-switch swipe is opt-in. Native vertical scroll wins.
- Categories retain manual picker order; category selection is per-account via existing Settings row. Scroll position is kept per owner/category in the current page session.
- Performance: lazy Category View import, deferred Home view picker, bounded old/future date groups, no category-date Cartesian product or backend migration.

### Known limits to review before promotion
- Long-press manual task reorder *within Category View* is deferred pending gesture arbitration against horizontal swipe; the existing Day View continues to provide reorder.
- Date-header Move quick action opens the existing Task Action Sheet rather than preopening the Date editor.
- Advanced swipe bindings (complete, previous/next day, duplicate as direct gesture) are intentionally deferred; only Off and safe action reveal are exposed.
- Physical touch/trackpad and large-image timeline performance require owner acceptance and real-device validation; GitHub CI cannot substitute for these.
- Do not claim Preview readiness unless exact-SHA focused/full CI, official Preview build READY, and runtime Appwrite target evidence are verified.

### v0.127.1 Preview refinement
- Category pill trigger shows the selected category's original color dot as well as the label; category options keep the same original swatches.
- The Home view selector is now the shared accessible portaled MosaicSelect listbox instead of a native browser select. Its wider icon/chevron trigger reserves explicit space for the arrow; the popup module is loaded only on first interaction to preserve Home startup and bundle budgets.
- Task rows in Category View are transparent in their normal state, allowing the selected full-Home wallpaper to remain visible; action reveal temporarily uses the semantic surface to keep Move/Copy/Delete legible. Canonical task completion and editing UI are unchanged.
- Quick-add uses existing mosaic-material-panel, which follows authenticated owner wallpaper Soft Frosted/Solid, theme and glass transparency; no new per-row blur, backend write, or material preference. Fallback is the existing opaque semantic surface.
- Manual Light/Dark/Black, full-Home wallpaper, dim/glass transparency, mouse/touch, and non-wallpaper acceptance required before dev promotion.

- Home view reselection explicitly cancels a previous pending lazy-view request (for example Diary pending → Calendar), without changing default MosaicSelect behavior for other settings. The friend Home pane uses the same accessible selector.
- Friend Home view dropdown exposes only Calendar, To-do List, and Diary; Category View remains owner-only. Async-mounted friend headers are covered by the same navigation regression tests.

### v0.127.2 Preview refinement
- Hide the Today date group and its redundant timeline Today-jump control when the currently filtered category has no Today tasks. The quick-add date still defaults to Today and can create a Today group.
- Remove both standalone "Past dates" headings; individual dated groups remain, with their existing chronological sort preferences unchanged.
- Add compact Today, Tomorrow, and Yesterday shortcuts immediately beside the quick-add native date input. Each shortcut updates the same selected date state (with an accessible pressed indicator), handles local calendar-month/year boundaries, never submits the form, and preserves category lifecycle creation validation. On narrow phones the controls wrap within the existing glass panel.
- Verify quick-add date changes, Today/non-Today groups and category/date restrictions on Preview. No backend changes or dev/main promotion.

### v0.127.3 Preview refinement — Home category view icon
- The collapsed Home view selector now renders the same Lucide `Layers3` icon at the same 18px size as the asynchronously mounted MosaicSelect picker for Category View. It no longer uses the temporary `▦` glyph. This prevents the icon from visually changing on first opening the selector after returning to Home from another route.
- Preserve first-interaction lazy-loading of the Mosaic dropdown and its accessible menu; do not import the full menu eagerly or change active-view persistence, user/friend isolation, or other icon behaviors.
- Regression covers category selection before/after lazy picker mount and after a simulated Home remount. Preview size policy, canonical CI and device acceptance remain required before any promotion.
