# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 local-first task startup — cold owner-query prewarm diagnostic.

## Approved boundary
- User requested continued structural startup optimization; investigate parallel task loading and scaling. Keep #858 OPEN; accepted dev v0.29.8 `bfb0fff0c1c283f599f32db8c2a426416fa65e7b` unchanged. No stable Preview/dev/main/Production/1.0/backend promotion authorization. Do not ship diagnostics.
- This isolated branch `chatgpt/858-query-prewarm-lab-20261018` forks verified `chatgpt/858-structural-scaling-lab-20261018@ea328e71668de2b0267f369a811f24119f12c805`, which contains synthetic-account-only RxDB fixtures. Another independent branch `chatgpt/858-proximity-motion-lab-20261018@980d1a7c6475112b53cbecdb3254e2e98299f69a` measures conditional idle Framer layout and first touch hold; see issue thread for separate results.

## Evidence to explain experiment
- Default cached-user `main.tsx` already starts RxDB bootstrap, Home and AppDataShell module preloads concurrently. But `HomePage` only starts `useTasks` owner-wide sorted RxDB subscription later inside a React effect. The query selects `userId` + `isDeleted=false`, sorts by date/createdAt. Existing indexes include owner/deleted and date/owner/deleted, but no measured cold planner evidence.
- Prior [render-graph #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) and [idle-motion #39102669699](https://github.com/carlers/mosaic-life-tracker/actions/runs/39102669699) succeeded: dense Todo load is dominated by task-row and drag layout work, but first subscription to cached storage can also take ~200–330ms. Warm RxDB `find().exec()` query-cache median ~0ms DOES NOT establish cold-load speed or a concurrency benefit.
- Diagnostic-only `main.tsx` checks CI build flag, synthetic cached user `issue858_scale_user`, and localStorage variant `prewarm`; after protected local DB bootstrap succeeds, it issues one owner-scoped read with the same selector/sort as `useTasks` (does not create a shadow store, unguarded access, Appwrite dependency or second persistent subscription). Marks prewarm start/complete. React `useRxCollection` records task subscription creation and first emission.
- Playwright independently seeds real IndexedDB task snapshots 0/25/250/1000 dense and 1000 over multiple years; same compiled bundle and cached service worker compares baseline/prewarm × Calendar/Todo × slow-online; dense 1000 also offline × n=3 = **72 launches**. Verify all selected-day tasks and first Add action, query->Home, DB->task mark, dom size. No physical device or real account/Diary/photos/shared coverage.

## Next action
- Verify focused gate and diagnostic browser build/CI. Analyze matched per-variant p50/p90 and query mark timing; if prewarm causes contention or no benefit, reject. If beneficial, require isolated product implementation preserving cached 401/account switch and ensuring no task data is exposed before protected auth gate. Long-press, Diary/shared/fast date jumps and device manual checks remain required. Never promote research branches. Security #936 and backend #914 are separate pre-1.0 gates.
