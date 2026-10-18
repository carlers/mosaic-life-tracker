# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 structural Calendar/Todo startup performance; research-only proximity-gated drag-layout experiment.

## Approved boundary
- User requested continuing structural work, parallelization and lower startup growth with task count. #858 remains OPEN. Accepted v0.29.8 `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` unchanged; no stable Preview, dev/main, Production, 1.0, or Appwrite backend promotion authorized.
- Branch `chatgpt/858-proximity-motion-lab-20261018` forks the successful prior diagnostic branch `chatgpt/858-idle-motion-lab-20261018@ad33179ab1690a50aeec4c067c0ca57d3b42103d`. **Neither this nor its parent is deployable product code**; it includes synthetic-only owner fixtures and experimental interaction-destroying variants as controls.

## Verified evidence
- [Render-graph CI #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) SUCCESS: 147/147 Chromium samples. Todo 1000 same-day startup current 1592ms; disable drag runtime 1255ms; inert rows 774ms; all destructive baselines.
- [Idle Motion CI #39102669699](https://github.com/carlers/mosaic-life-tracker/actions/runs/39102669699) SUCCESS: 90/90 samples. At 1000 dense slow-online 2x CPU, current 1542ms; no idle layout 1409ms; omit offscreen inert drop targets 1467ms; combined 1357ms. At 250 dense current 913 vs combined 810ms; at 25 644 vs 641ms (noise / insignificant). Offline 1000 dense current 1613 vs combined 1415ms. Rendering work matters most for dense days, and ordinary 25 tasks sees negligible benefit.
- `useTaskReorderProximity` already switches dnd-kit hook registration 800px ahead of viewport; `TaskRowDropSurface` retains idle Motion layout and 2 passive absolute divs for far-offscreen rows. Removing drag itself is unsafe and not approved.

## Current experiment
- With the existing CI-only `VITE_MOSAIC_858_SCALING_LAB` and synthetic cached owner guards, test `near-motion` and `near-motion-no-passive`: keep Framer layout enabled when a row is already registered/near the viewport, disabled only far offscreen; the passive option omits only inert offscreen divs. Compare to same-binary baseline and prior `no-idle-motion-no-passive` as a diagnostic ceiling.
- Same real IndexedDB persisted task fixtures 0/25/250/1000 dense and 1000 month; 3 repeats, offline 1000 dense plus slow-online all, 72 launches. Test complete task DOM and first Add response as before; separately use real Chromium CDP 610ms touch holds to assert **both** the initially eager 25-task row and row #25 reached by scrolling activate overlays and cancel cleanly, for baseline and both near variants. This extra long-scroll regression was added after initial CI completed; a new exact-SHA run must pass.
- This is neither an accepted product candidate nor full gesture regression. It does NOT establish first painted frame, physical Android/iOS touch, cross-category reorder or Diary/photos/shared safety. No CSS/production code shipped.

## Next action
- Initial diagnostic #39104388237 and focused #39104388202 both SUCCESS; rerun focused/own diagnostic CI for the added last-row-after-scroll gesture regression, fix any failure. Compare per-condition p50/p90, first long-press overlay and DOM counts. If meaningful, consider narrow behavior-preserving production candidate separately with automated 500ms drag, category changes, auto-scroll, diary/social/photo, account isolation plus CI-first Scratch Preview and real PWA device acceptance. No dev promotion without owner approval. #936 privacy and #914 backend pre-1.0 gates separate.
