# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 — structural Calendar initial task-preview rendering optimization after accepted v0.29.10.

## Source, approval and limits
- Owner reports the v0.29.10 Todo/Diary compact-month bugs fully fixed in manual testing, requests continuing Calendar initial-mount performance. Keep #858 OPEN; #957 accepted on Preview but not promoted. Owner has **not** approved Preview→dev/main/Production or v1.0 release.
- Stable starting source: `perf/858-todo-diary-grid-20261018@796085e23d7e48df5451849a878b0962a8e1cee8` (v0.29.10), canonical [#39118517009](https://github.com/carlers/mosaic-life-tracker/actions/runs/39118517009) and trusted Preview delivery [#39118661130](https://github.com/carlers/mosaic-life-tracker/actions/runs/39118661130) SUCCESS. `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b`, `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged.
- New *clean* product candidate branch `chatgpt/858-calendar-taskblock-flat-candidate-20261018` direct fork of current Preview. Stage **v0.29.11** with package, lock and appVersion; no backend/schema/data/query/appearance/route change.

## Rejected idea and matched evidence
- `chatgpt/858-calendar-deferred-neighbors-20261018@1d6c110946506eba178b57ff48af58e33f67a6a1`: focused + 2 browser shards [#39120707123](https://github.com/carlers/mosaic-life-tracker/actions/runs/39120707123) SUCCESS and actual first swipe. But SAME-RUNNER render lab [#39120787129](https://github.com/carlers/mosaic-life-tracker/actions/runs/39120787129) SUCCESS, n=5 each, shows 1000 dense 205.7→267.7ms (+62), despite 0/25 gains. **REJECTED**; no owner Calendar runtime/state modifications from this in the new clean candidate. Prior permanent active-only ablation is not a safe shipping proxy.
- Separate **diagnostic ONLY** `chatgpt/858-calendar-taskblock-flat-lab-20261018@af5f40ad004797b8812acf5c2f1e0d3774d7b28e`; focused Quality Gate [#39121269210](https://github.com/carlers/mosaic-life-tracker/actions/runs/39121269210) SUCCESS, same-runner paired 2× CPU DOM render [#39121269247](https://github.com/carlers/mosaic-life-tracker/actions/runs/39121269247) SUCCESS 40/40. Render firstReady median original→flat: 0:55.7→56.0ms, 25:71.2→67.4ms, 250:167.2→130.3ms, 1000:268.8→242.5ms. Two-frame 1000 355→305.5ms, DOM 5638→3638 nodes; TaskBlock 19.75px and whole slide scrollHeight 23285px exactly equal in 1000 synthetic text-only case; all task count preserved. These are same-context synthetic reveal timings, **not** physical device or end-to-end Home-startup proof.

## Clean implementation candidate
- Only `src/components/home/views/TaskBlock.tsx` runtime: text-only, unshared task preview renders a clipped one-line span instead of the original three-layer flex structure. Same outer tooltip, width, text size, color modes, background, inset border, corner radius, task order and day-cell semantics; image-bearing or shared tasks retain the *exact original rich path* (image observers and friend marker). No lab URL toggle, no deferred-neighbor state or diagnostic workflow in product candidate.
- Focused new `tests/components/TaskBlock.test.tsx` checks text previews, completed/category mode, thumbnail and shared marker. Existing Calendar TaskBlock theme color browser test and first touch/swipe/zoom/day-sheet contracts run.
- Product candidate staged version 0.29.11; stamp once before next user-testable Preview. Future state depends on exact-SHA CI.

## Verification and handoff
- Commit scoped task+checkpoint with [verify:browser]; repair any focused or browser failures, do not misclassify them. If green, PR squash from task to NEW stable `perf/858-calendar-flat-taskblock-20261018` forked from v0.29.10, canonical CI plus trusted CI-first Scratch Preview READY, independent source and deployment check. Do not mutate v0.29.10 stable.
- Owner manually verifies identical Calendar text/image/share display, Light/Black themes, scrolling, first and repeat touch, task counts and startup impression on installed PWA. Physical first-paint not measured. #858 remains OPEN for further structural optimization after this small gain. No dev/main/Production/1.0 promotion without explicit approval.

## Next action

- Verify corrected documentation-contract checkpoint through focused Quality Gate on exact task SHA; squash to new independent stable Preview only after all checks pass. Verify canonical gate and trusted Preview READY. Keep #858 OPEN and await real-device acceptance before any dev/main promotion.
