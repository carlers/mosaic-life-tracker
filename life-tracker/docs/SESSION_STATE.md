# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #856 — remove subtle flicker at cross-day task drop.

## Live baseline and owner feedback
- Owner confirms previous v0.34.7 edge-release and no-overlap fixes work, but cross-day drop has a brief flash when settling; same-day reorder settles smoothly. Preserve touch release, timers, destination gap, saving and unrelated gestures.
- Stable Preview `feature/cross-day-drag-856-20261020@ad52a93f8c5d6d77d89a68b5dbe508b8e5a7a7c4`, v0.34.7, canonical Gate #39448892769 success on attempt 2, Vercel exact-SHA READY. Separate dev `0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0`; no approval to promote. Issue #856 remains open.
- Task branch `chatgpt/856-smooth-cross-day-settle-20261020`; PATCH candidate v0.34.8.

## Cause and narrow repair
- Before v0.34.8 the active destination `DaySlide` switched `ReadOnlySlide` → `TaskReorderRuntime` as soon as the temporary `continuousDrag.projection` cleared. That unmounted/remounted the **entire task list** while the gap became a saved row, visually flashing despite non-overlapping bounds.
- Keep the already-active day in `TaskReorderRuntime` during carried drag, settling and normal mode. Native task sorting remains disabled while a held/settling projection exists.
- Keep `DayViewCategoryReorder` in its usual `Reorder.Group` / `Reorder.Item` structure during external carry on the active day, with `canStartDrag=false` until release. This prevents swapping layout wrappers from `LayoutGroup` → `Reorder.Group` when settling clears.
- While carried externally and the active runtime is mounted, render destination siblings as the exact same `TaskRowDropSurface` and `DraggableTaskItem` component tree used by native same-day reorder. Their stable keyed DOM/task content no longer remounts at drop. Non-active/read-only slides retain cheap normal rendering; do not add providers to all virtual slides.
- Keep v0.34.7's overlay removal + reserved neutral gap through commit and two frames; no extra colored UI or toast.
- Extend existing CDP browser edge/category release regression: record stable task+category DOM elements before releasing in a populated next-day category and assert those same actual elements remain connected/active after settling, in addition to no overlapping rows and stable date.

## Delivery
- Verify task focused/browser gate, repair any test/build failures, squash to stable Preview, run full canonical CI, then deploy exact-SHA Vercel Preview READY and checkpoint issue.
- Owner phone visual smoothness still requires physical Android/iOS acceptance; persistence/offline sync and >87-day rebases remain manual.
- Do not promote dev/main, deploy Production, or change backend/schema.
