# Session checkpoint

Updated: 2026-10-01
Current task: Remove the slight vertical compression/jump visible on neighboring Day View slides while swiping between days.
Status: The prior mouse day-swipe polish is manually accepted. The preview-spacing repair is implemented on `chatgpt/polish-day-slide-preview-spacing`; exact-SHA verification remains before promotion.
Next action: Run the full canonical Quality Gate, repair any failures, squash-promote to `feature/task-reorder-clean`, verify the stable Vercel Preview is READY, then manually swipe through several sparse/empty days and confirm category spacing no longer expands at snap.
Blockers: None.

## Accepted baseline
- Fresh-open task rendering, legacy multi-task rendering, same/cross-category reorder, consecutive drags, and category-boundary stability are accepted.
- Desktop mouse day-swipes starting on task title/memo are accepted; stationary 500 ms title hold still reorders.
- `025639666a52e4a047331329ad60fc18d9b1c96d` is the stable checkpoint before this spacing polish.

## Root cause
- The inactive neighboring slide renders the same categories without active reorder drop surfaces.
- In the inactive path, the category header used `margin-bottom`; in the active reorder path, the equivalent spacing used `padding-bottom`.
- When a category had no task rows, the inactive header's bottom margin could collapse with the category container's own bottom margin.
- The inactive/preview stack was therefore about one spacing token tighter. When the slide became active, the reorder header used non-collapsing padding and the categories expanded vertically at the end of the swipe.
- This was a layout-shell mismatch, not Swiper scaling or animation compression.

## Fix
- Added one shared `CategoryHeaderFrame` with non-collapsing `padding-bottom` geometry.
- Both inactive/non-reorder headers and active droppable headers render through that same frame.
- Active mode only adds the droppable ref/metadata; it no longer changes vertical layout.
- Task rendering, drag/drop collision behavior, persistence, Swiper windowing, and task interactions are unchanged.

## Verification
- Added a real Day View browser regression using the adjacent empty day: measure category spacing while it is inactive, swipe it active, and require the spacing to remain unchanged within browser-pixel tolerance.
- Existing mouse-swipe, touch reorder, category-boundary, empty-category, cross-category, and runtime-rebuild coverage remains.
- Full canonical verification and stable Preview promotion remain.
