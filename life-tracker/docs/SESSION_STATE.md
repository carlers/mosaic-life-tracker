# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #856 — repair v0.34.5 physical touch regression, normal reorder animation parity, remove success toast.

## Live state / owner feedback
- Owner confirms laptop v0.34.5 drag works but says mobile touch is even less reliable than v0.34.4; category/task movement still feels abrupt compared with same-day reorder. Also explicitly requests removing success toast "Task moved to [date]".
- Baseline stable Preview `feature/cross-day-drag-856-20261020@05bf90be028b21add152924a786c84319391477c` (v0.34.5), canonical Gate #39437963039 SUCCESS and Vercel READY. Current separate `dev@0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0`, no promotions authorized.
- Issue #856 open; task branch `chatgpt/856-mobile-gesture-motion-20261020`. PATCH candidate v0.34.6.

## Findings and repair
- On first cross-day swipe v0.34.5 captured an active touch again on a newly mounted carried-task portal while body already captured it; on mobile touch WebKit this is an unsafe extra capture transition and may lose the stream. Remove this overlay capture; retain the stable session and body handoff.
- V0.34.5 listens to BOTH touchmove and pointermove and used capture-phase preventDefault in native task-dnd phase. Limit native-scroll interception to external cross-day ownership, update visual overlay synchronously but coalesce category/index hit-testing/rendering into one requestAnimationFrame. Pointercancel can be generated when the source slide disappears even while the physical TouchEvent identifier is still active; do not mistake it for touchend after external handoff. Touch end/cancel is targeted at the original touched title even when Swiper detaches it and may no longer bubble through window. Retain direct touchmove/end/cancel listeners on that original element until the gesture terminates, then detach. Never allow a released/canceled touch to leave an orphan overlay; mouse still ends on physical release.
- Category projection lost the normal `Reorder.Item` outer motion layout when `DayViewCategoryReorder.enabled=false` during cross-day carry. Add a layout-only Motion/Framer LayoutGroup around categories for external carry (without enabling native category dragging), keeping same-day reorder unchanged. Existing stable neutral insertion slot and row layout transitions remain, no colored drop visuals.
- Remove successful cross-day date move toast; retain failures and safety feedback.
- Browser physical-touch regression now injects pointercancel while the same TouchEvent finger remains held across the first cross-day slide and checks overlay survival. Existing populated destination-slot movement, reverse/repeat, mouseup, and same-day drag tests continue.

## Verification / delivery
- Run focused and both browser shards on task branch, repair failures. Squash into stable Preview only after focused green; canonical gate and exact-SHA Vercel READY; update issue with checkpoint.
- Actual iOS Safari/Android touch, smoothness, repeated navigation, release, final drop persistence/offline sync, >87-day rebasing remain physical/manual acceptance. Issue stays open.
- No dev, main, Production, backend, schema or 1.0 changes authorized.
