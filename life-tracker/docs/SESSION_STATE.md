# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 compact Todo/Diary month grids blank after Today/frequent arrows; first Calendar→Todo/Diary switch blanks.

## Approved boundary
- User asked to fix these bugs (also reported on main) and continue structural startup work. Calendar itself works and should remain unchanged. #858 OPEN. No dev/main/Production promotion approved.
- New task branch chatgpt/858-todo-diary-grid-mount-fix-20261018 forks delivered Scratch Preview perf/858-todo-row-20261018@1769452d5139d1bd67de166a40e9e1583224535d v0.29.9. Stage **v0.29.10** for next user-testable revision; dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b and main@b952f71ecd2add3172f90104bc0e856a2648ccc9 untouched.

## Diagnosed issues and candidate
- Shared TodoCalendarGrid.tsx had 61 finite Embla slots anchored forever to initial month, and only three month grids rendered relative to delayed activeIndex; external Today jumps and rapid arrow commands could point to unrendered grids or exceed supported snaps. Candidate rebases when focus month moves >24 months from base, reinitializes centered viewport, renders both focused target and selected neighbors, and guards programmatic snap select events from writing stale months into the parent. Applies automatically to both owner/friend Todo and Diary, not Calendar.
- Owner PersonPane and FriendPersonPane dynamically imported the SAME TodoListView separately behind fallback=null. Home's existing idle warmup only loaded DayViewSheet. Introduce a shared createPreloadedLazy module, start its loading ONLY after local Calendar data ready and existing DayViewSheet warmup in HomePage. On view switch before preload resolves, leave Calendar visible until import ready and ignore outdated pending requests; use React transition to mount Todo/Diary. No eager task-view or drag-tree mounting.
- Browser harness supports synthetic compact Diary/ Todo month jumping, reset and 68 rapid arrows. New browser contracts assert actual month grid and day cells, not just header title. PersonPane unit mocks delayed Todo module: Calendar must remain visible until resolve and canceled view change must not reappear.
- Version stamped 0.29.10 in package, lockfile and appVersion only. No schema/backend, styling or data-query change.

## Verification / limits
- Commit this task and checkpoint with [verify:browser], run focused + browser shard checks; fix failures. Review Bundle/home closures and version guard. If ready for next Preview, use a new stable Preview branch from v0.29.9 (leave prior stable immutable), squash task after focused green, wait for exact-SHA canonical Quality Gate and trusted prebuilt Vercel READY; still no dev/main promotion.
- The lazy-loading fix hides module-download blank, but synchronous first Todo mount cost may remain, so measure actual first view-switch separately before claiming performance goal complete. Physical phone, installed PWA, diary/photo/shared, offline and owner manual checks remain outstanding.
- Security #936 / backend #914 distinct.

## Next action
- Commit scoped task files, verify exact SHA CI, repair issues and record issue #858 checkpoint. Do not alter previously delivered v0.29.9 or dev/main/Production.
