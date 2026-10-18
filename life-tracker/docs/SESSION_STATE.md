# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 Todo near-viewport drag Motion optimization — unpromoted product candidate.

## Approved boundary
- User approved continuing structural Calendar/Todo performance research, including concurrency and task-count scaling, not declaring #858 done. Keep #858 OPEN.
- Accepted v0.29.8 `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` remains unchanged. No stable Preview, dev/main, Production, backend or 1.0 promotion approval; never deploy experimental branches. A subsequent **user-testable** Preview would require a fresh patch version (provisionally 0.29.9, verify collision first), full canonical CI + Scratch Vercel READY and user acceptance.

## Verified evidence
- [Structural render-graph lab #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) SUCCESS: dense Todo render cost dominated by active TaskItem and DnD subtree. Destructive removal of DnD is NOT acceptable.
- [Idle Motion lab #39102669699](https://github.com/carlers/mosaic-life-tracker/actions/runs/39102669699) SUCCESS: 1000 dense Todo p50 baseline 1542ms; no idle layout + no inert offscreen targets 1357ms. Small density savings marginal.
- [Near-viewport Motion lab #39104388237](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388237) SUCCESS: 72 same-build synthetic cached-PWA launches with 2x CPU, slow-online and offline. Todo 1000 dense slow-online p50 baseline 1580ms -> near-Motion plus skip inert far-targets 1402ms; 250 dense 895→834ms; 25 dense 634→616ms; 1000 across month 919→877ms. All task row DOM retained and first **eager** row 610ms touch hold exposed actual drag overlay and canceled cleanly. n=3 and browser marks are directional, not physical device SLA.
- [Cold RxDB prewarm lab #39104822049](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104822049) SUCCESS, but mixed/near-zero normal-case benefit and 1000 dense tail regression; **reject** naive early duplicate whole-history query.
- Follow-up far-scroll drag lab `chatgpt/858-proximity-motion-lab-20261018`: [#39105165737](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105165737) failed before touching due transient null bounding box in unchanged baseline when scrolling to row 25; fix now polls stable bounding box on branch `706004b1634fed84381e260b8a322571e8cda34e`; [#39105404416](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105404416) requires exact result readback, do not assume passed.

## Product candidate changes
- `chatgpt/858-viewport-reorder-candidate-20261018` forks accepted dev, without synthetic perf lab code.
- `src/components/home/views/TaskReorderSurfaces.tsx`: Keep real DnD hooks and TaskItem across all rows, but delay Framer `layout="position"` until existing `useTaskReorderProximity` 800px buffer marks the row near/active. Omit only two pointer-events-none, aria-hidden, unregistered passive drop-target elements for distant rows. All near/active drop targets, registered gestures and source-slot/diary behavior remain in code.
- `tests/e2e/interaction-contract.tsx`: a query-param-only synthetic fixture with 30 tasks in one category (13+ row probes are not eager). Existing fixtures otherwise unchanged.
- `tests/e2e/interaction-contract.spec.mjs`: assert last row initially readable but no DnD registration, scroll it into view and ensure proximity registration occurs, first 550ms long-press creates real drag overlay and cancellation restores row. Existing cross-category, Diary, drag animation and scroller browser tests remain unchanged.

## Next action
- Run focused+browser task gate on exact candidate commit; investigate and repair genuine failures, not weaken guards. Check separate far-scroll real-app diagnostic when completed. Before any stable Preview, broaden to slower device/overflow/scroll, keyboard, first gesture after rapidly scrolling, cross-category/empty/collapsed DnD, Diary variable heights/photos, friend/shared, accessibility, account switch/401; obtain owner manual Android/iOS/desktop installed PWA acceptance. No promotion without explicit approval. Keep independent pre-1.0 #936 security and #914 backend gates separate.
