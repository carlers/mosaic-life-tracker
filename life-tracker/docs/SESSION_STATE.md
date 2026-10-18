# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 Todo/Calendar structural scaling research; nonanimated TaskItem native-frame comparison.

## Approved boundary
- Owner requests continued structural research on task rendering/loading and parallel work, maximizing fast first usable Calendar while addressing Todo task-count scaling. Issue #858 must remain OPEN.
- Accepted `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` v0.29.8 unchanged. No stable Preview/dev/main/Production/backend/1.0 promotion authorized. This experimental branch contains synthetic owner instrumentations and must never be deployed or merged as product code.

## Verified evidence so far
- [Full render-graph lab #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) 147/147 SUCCESS: 1000 dense Todo baseline 1592ms, entirely disabled drag 1255ms, inert rows 774ms; Calendar active-month-only 1000 current-month 746→659ms but swipe edge not verified.
- [Idle Motion lab #39102669699](https://github.com/carlers/mosaic-life-tracker/actions/runs/39102669699) 90/90 SUCCESS: 1000 dense Todo baseline 1542ms, no idle Motion 1409ms, omit unregistered passive targets 1467ms, combine 1357ms; 25-task benefit negligible.
- [Proximity lab #39104388237](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388237) 72/72 SUCCESS and [focused #39104388202](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388202) SUCCESS on `980d1a7c6475112b53cbecdb3254e2e98299f69a`. Proximity-gated Motion + remove unregistered passive targets Todo dense 25/250/1000 slow-online Home-ready p50 616/834/1402ms versus baseline 634/895/1580ms; 1000 across month 877 vs 919ms; offline 1000 dense 1473 vs 1597ms. First real Chromium 610ms touch overlay + cancel succeeded baseline and both near variants with 25 tasks. Does not prove cross-category or physical device drag.

## Current diagnostic branch
- `chatgpt/858-native-task-frame-lab-20261018` forked from proximity lab `980d1a7c...`. Tests `native-task-frame` (TaskItem already passed `disableLayoutAnimation` renders a normal div rather than mounting a Framer Motion wrapper) versus baseline and `near-motion-no-passive`, plus combined `near-motion-native-task-frame`. Entire task row contents, title/edit/memo/toggle gestures and dnd-kit hooks remain. Task overlay stays Framer Motion. Changes guarded by CI-only `VITE_MOSAIC_858_SCALING_LAB=1`, synthetic account identity and variant localStorage; **not for runtime release**.
- Benchmark 0/25/250/1000 same-day and 1000 across month, same-binary slow online plus 1000 dense offline, 2x CPU, PWA locally seeded real RxDB; 72 browser samples. Assert all row DOM counts retained, actual native frame replacement cardinality, first Add response and first 610ms long-press overlay and cancel at 25 rows, account fenced. First paint/real device, Diary/shared/photos/keyboard and cross-category not proven.

## Next action
- Finish focused and isolated diagnostic CI on exact SHA; repair tests, no promotion. Compare results by density/task count to judge whether native frames add meaningful value to near-viewport strategy. Before any runtime candidate, require long-press/cross-category/scroll/diary/selection/accessible task actions automated coverage and installed PWA manual acceptance. Continue isolating Calendar first actionable path; don't optimize only pathological 1000 tasks same day. Security #936 and backend #914 remain separate mandatory pre-1.0 gates.
