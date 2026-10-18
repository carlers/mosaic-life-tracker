# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 — accelerate default Calendar initial mount without changing visible content or first-gesture behavior.

## Approval and exact source
- User manually accepted v0.29.10 Todo/Diary navigation fixes on 2026-10-18 and requested renewed Calendar initial-mount optimization. #957 acceptance comment filed; separate integration approval remains required. #858 OPEN.
- Task `chatgpt/858-calendar-deferred-neighbors-20261018` forks accepted Preview `perf/858-todo-diary-grid-20261018@796085e23d7e48df5451849a878b0962a8e1cee8` v0.29.10. Next user-testable revision provisionally **v0.29.11**. `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b`, `main@b952f71ecd2add3172f90104bc0e856a2648ccc9` unchanged. No dev/main/Production, backend/schema/Function/1.0 approval.

## Evidence and hypothesis
- Earlier SAME-RUNNER [render-graph lab #39101668402](https://github.com/carlers/mosaic-life-tracker/actions/runs/39101668402) (old v0.29.8-era build), 3x mobile Chromium 2xCPU synthetic cached PWA slow-online: rendering ONLY the active Calendar month vs normal three on initial mount gave Home-ready p50 25 tasks 440→406ms; 250 505→476ms; 1000 dense 711→629ms; 1000 distributed years 544→485ms. The ablation omitted neighbors permanently and therefore **could not ship**: first swipe/fast navigation require neighbors. These results are directional lab evidence, not proof that the new deferred warmup has the same gains.
- Current candidate uses `useCalendarState({deferNeighbors:true,ownerDataReady})` only on the OWNER Calendar. Initially render focused slide (plus any current embla/focus transition), then after owner local-data readiness and two requestAnimationFrame callbacks mount ±1 neighbors in a lower-priority React transition. Pointer-down, trackpad-wheel, month arrow, zoom navigation, Today or view toggle proactively restores both neighbors immediately. Friend Calendar remains unchanged. Keep 61 Embla snaps and focus/active indexing, no data filtering or cosmetic/layout changes. Home passes owner data readiness through PersonPane to Calendar hook; CalendarCarousel signals the first user interaction.
- New useCalendarState unit tests assert zero neighbors until ready, post-paint warmup, immediate first-arrow restoration; CalendarCarousel component test asserts pointer signal; browser contract uses real Calendar path with forced unresolved owner-ready and verifies current-only content becomes three grids on first pointer. Default Calendar gesture tests continue.
- Version stamp 0.29.11 across package, lock root and appVersion. No other app functionality changed.

## Verification and next steps
- Final task needs scoped commit with [verify:browser], focused checks and both browser shards; investigate/fix failures before any Preview. Check full build/size and real first swipe. Contrast a same-runner matched v0.29.10 vs v0.29.11 local cache/dense task benchmark; old permanent-ablation measurements are not equivalent to this deferred implementation. Do NOT present old gain numbers as newly achieved.
- If behavior and measurements justify release, squash to NEW stable Preview from accepted v0.29.10 (never mutate accepted stable) and check canonical CI-first Vercel Scratch READY. Any later dev/main promotion requires separate explicit owner approval.
- Physical phone/installed PWA, first-paint/interaction latency, zoom swipes, rapid arrows, photos/shared content, offline/account switching remain human acceptance items. Security #936 and backend #914 separate pre-1.0 gates.

## Next action
- Commit candidate and tests once, run CI, repair findings; measure actual first-Calendar-owner-ready and initial 2-frame paint before claiming optimization. Keep #858 OPEN.
