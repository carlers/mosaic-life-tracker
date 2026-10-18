# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 structural Calendar and Todo cached task startup, query prewarm hypothesis.

## Approved boundary
- User asks to keep optimizing initial task mounting with algorithmic improvements and safe parallelization; #858 remains OPEN.
- Stable dev `bfb0fff0c1c283f599f32db8c2a426416fa65e7b` v0.29.8 unchanged. No stable Preview/dev/main/Production/1.0/backend promotion is authorized. All #858 experiment branches use synthetic cached owner and CI-only build flag, are NOT deployable.

## Evidence already verified
- [Structural data/render benchmark #39097381435](https://github.com/carlers/mosaic-life-tracker/actions/runs/39097381435): 84/84 synthetic launches; 1000 tasks same-day vs across years Todo Home-ready 913ms vs 413ms, with 9706 vs 1743 DOM elements, suggesting visible tree scales much worse than local history.
- [Render graph #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) 147/147 success; inert task row and disabled drag reduce dense mount substantially but cannot ship.
- [Idle Motion #39102669699](https://github.com/carlers/mosaic-life-tracker/actions/runs/39102669699) 90/90 success; dense Todo 1542ms baseline vs 1357ms combined offscreen passive-target/idle-Motion ablation.
- [Near-Motion lab #39104388237](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388237) 72/72 SUCCESS; exact-SHA Quality Gate #39104388202 success. 1000 dense Todo 1580→1402ms with only near-viewport layout Motion and inert far-target omission; 25 tasks 634→616ms. First 610ms long-press overlay/cancel succeeded baseline and near variants in Chromium. Physical drag/Dairy/shared/photo still require verification.

## This branch
- `chatgpt/858-prewarm-query-lab-20261018` forks last VERIFIED standalone structural scaling experiment `ea328e71668de2b0267f369a811f24119f12c805`; **diagnostic only**.
- `main.tsx` test-only option `prewarm-owner-query` after cached-auth DB bootstrap: exec **exact same** owner + isDeleted + date/createdAt sorted RxDB query before the Home useTasks subscription, while shell modules load. No second task cache, no new query semantics. Only gated for `issue858_scale_user` under CI-only flag, no Appwrite access. The regular Home task subscription stays identical.
- Benchmark same-build A/B `baseline` vs `prewarm-owner-query`, Calendar and Todo, real locally persisted synthetic RxDB, 0/25/250/1000 dense, 1000 month, 1000 years; 3 repeats per mode, slow-online plus offline 1000 dense, PWA cached mobile Chromium 2x CPU (84 launches). Evaluate total owner-ready, DB->tasks-ready, post-query ready, FCP, click/add DOM response, full DOM task cardinality and prewarm timing. Assert offline network isolation and SW control. Do not infer parallel speedup from prior warm query-cache microbenchmark with zero medians.

## Next action
- Finish focused and dedicated diagnostic CI, repair any test-only errors, inspect per-variant matched medians, reject prewarm if its extra IndexedDB/JS work delays normal-case startup. Independently analyze native TaskItem frame CI `chatgpt/858-native-task-frame-lab-20261018@6046d1ac50d067354936aa4029bf2c2019a7896b`.
- No runtime optimization promoted without sufficient first-gesture, fast-swipe, account isolation, selected dates, shared/Diary/photos and physical device tests. Keep #936 security and #914 backend readiness as separate 1.0 gates.
