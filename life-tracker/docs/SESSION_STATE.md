# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 Calendar-first cached-task performance diagnostics; runtime unchanged.

## Release boundary

- Stable v0.29.6 Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: canonical #39013268008 SUCCESS, Vercel #39013382108 READY. No dev/main/Production/1.0 authorization.
- Isolated diagnostic branch `chatgpt/858-offline-online-pwa-20261017`: synthetic/browser tests, scoped workflow and checkpoint only. No live backend writes, app behavior changes, schema changes or promotion.

## Verified evidence

- The former 125-launch offline/online/uncached scale test at `2f6daf18c3e610b52987dde183ee2c6d787dc6bc` succeeded in #39028694839: 0/25/100/250/500 same-day Todo tasks, five repetitions each across five modes. Cached slow-online Home p50 892/1002/1145/1616/2512ms, offline 911/1016/1201/1677/2448ms.
- Latest diagnostic `0bff3bfd5a6110dfb2f28770f83e1d8d0c9899ba`: focused #39029949247 SUCCESS, existing startup lab #39029949268 SUCCESS, 125-launch scale #39029949275 SUCCESS.
- **Limitation discovered:** the existing seed persists `mosaic_home_view=todo`. Those timings characterize the Todo inline/day-reorder path, not default Calendar.
- Calendar source uses `useTasksByDate`, 61 logical slides with full grid contents within ±1 month, `DayCell` rendering each day's tasks, and `TaskBlock` image-load observer hooks even when `task.image` is absent. These are performance hypotheses, not measured causal findings.

## Current diagnostic change

- Add `tests/e2e/startup-calendar-volume.spec.mjs` comparing default Calendar and Todo on exactly matched existing 0/25/100/250/500 UI-persisted task snapshots, cached offline and cached slow-online (three interleaved repeats), and a same-data/190-day-distant Calendar control at 500.
- Record per-sample task notification→owner-ready, FCP, DOM task presence, calendar block/day-cell counts, JS heap, long tasks and IntersectionObserver registrations; preserve original task-volume script and prior artifacts.
- Route the branch-scoped diagnostic scaling lab workflow to Calendar-first script; no user-shipped runtime logic changes. `[verify:focused]` requested on coherent diagnostic checkpoint.

## Diagnostic harness repair

- Initial Calendar-first lab #39032505720 FAILED after valid 0/25/100/250 samples and first 500 dense Calendar/Todo samples. The added 190-day fake browser clock for a distant-date control prevented the initial owner-ready mark during cache warmup; the exact underlying clock/storage interaction is unverified. Do not count the distant-date scenario as evidence.
- Remove only that unstable artificial-time fixture; retain exact same-store Calendar/Todo dense comparisons and raw observer/DOM metrics. Re-run with full tier completion before treating the lab as verified.
- Focused Quality Gate #39032505698 SUCCESS and independent slow-startup lab #39032505699 SUCCESS at the preceding diagnostic SHA.

## Next action

- Verify exact-head focused Quality Gate and Calendar-first lab (raw JSON and logs); investigate any failures, patch, rerun. Report only verified Calendar timing results and observed sources.
- Subsequently extend diagnostic fixtures to 500/1000 tasks spread across week/month, single/multi-category, images, zoom and distributed out-of-window dates, then profile Chrome CPU/React render and isolate image observers/neighbor slides. Do not infer causal attribution before A/B evidence.
- Retain #858 OPEN for real authenticated Scratch sync, physical PWA, cache eviction, 401, iOS and multi-tab checks. #936 and #914 remain independent 1.0 requirements.
