# Session checkpoint

Updated: 2026-10-18 UTC
Current task: issue #858 structural Calendar/Todo startup and task-count scaling. Current research is cold owner-vs-visible date-window query.

## Boundary
- User approved continued investigation, parallelization and faster task loading/rendering, preserving #858 OPEN. Dev v0.29.8 `bfb0fff0c1c283f599f32db8c2a426416fa65e7b` untouched. No promotion of any synthetic lab branch to stable Preview, dev/main, Production or 1.0.
- This branch `chatgpt/858-windowed-query-lab-20261018` forks verified diagnostic source `ea328e71668de2b0267f369a811f24119f12c805`; **never deploy/merge**. Only owner `issue858_scale_user` in CI-only `VITE_MOSAIC_858_SCALING_LAB=1` can exercise variant.

## Verified findings
- [Proximity + drag lab #39104388237](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388237) 72/72 SUCCESS. Todo slow-online same-day 25/250/1000 baseline 634/895/1580ms → 616/834/1402ms with near-view Motion and omit passive offscreen drop-targets. 1000 across month 919→877ms, offline dense 1597→1473ms. First 610ms long-press overlay/cancel passed baseline and near variants, but full drag/Diary/photos/device not accepted.
- [Early owner prewarm lab #39105689490](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105689490) 84/84 SUCCESS. Full RxDB owner query pre-executed after DB ready, while Home modules load. Effects marginal and inconsistent for default Calendar, and prewarm rarely finished ahead of normal first `useTasks` emission. **REJECT prewarm**: extra work/complexity not warranted.
- [Native task-frame lab #39105911960](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105911960) was still running at this checkpoint on SHA `51d216b797f323690bcd60ae22ce5013cb7dfd3e` (initial two build attempts failed TypeScript union; repaired exact-SHA build passed). No browser timing verdict yet.

## Current experiment
- Changing the first query's scope can be a distinct causal lever from prewarming an identical all-history query. Under test flag and synthetic owner only, `useTasks` adds a local date selector from start of previous month through end of next month, preserving owner/isDeleted/date/createdAt order. Baseline keeps all tasks. **The limited query deliberately breaks distant-date jumping/search/backlog and is NOT a user-facing implementation**; a real candidate would require a reactive two-tier reader with no missing data and strict auth.
- Compare 0/25/250/1000 same-day, 1000 current-month, 1000 across five years, baseline and windowed, Calendar and Todo, PWA cache, 2× CPU; 3 repeats slow online all and offline 1000 years. 84 launches. Validate current-visible DOM tasks, FCP, first Add/day click, DB-ready→tasks-ready vs post-query, DOM count. All Appwrite calls held.
- Need evaluate cold query index and whether shorter task set actually helps for 1000 historical tasks with ~17 active-month tasks. Check 1000 same-month: bounded query should NOT improve as rows remain visible.

## Next action
- Complete custom Actions and Quality Gate exact SHA, investigate and repair failures, record per-case same-build matched medians, no promotion.
- Independently complete native frame A/B and gesture verification. For any product design, require search/date jumps/owner switching, Diary/photos/shared, first gestures, stable Preview CI and physical-device manual checks. Security #936 and backend #914 remain distinct pre-1.0 workstreams.
