# Session checkpoint

Updated: 2026-09-26

Current task: keep the smoother Month/Week calendar settling from `perf/calendar-swipe-settling` while restoring rapid repeat swipes and making the snap feel responsive sooner.

Status: the first perf candidate was manually reported smoother, but its decision to defer all calendar state until Embla `settle` made rapid repeat swipes feel blocked and made the interaction feel as though settling lasted too long. The follow-up candidate restores lightweight selected-date/title state on Embla `select`, while keeping the expensive rendered-grid window pinned until `settle`. The active person's calendar also prewarms one extra Month/Week slide on each side during idle, so a second quick swipe already has real content without mounting another full grid inside the settling animation.

## Working set
- `life-tracker/src/components/home/PersonPane.tsx`
- `life-tracker/src/components/home/views/useCalendarState.ts`
- `life-tracker/tests/react/useCalendarState.test.tsx`
- `life-tracker/docs/SESSION_STATE.md`

## Completed substeps
- Preserved the accepted first-stage optimization: no full-grid window shift on Embla's high-frequency `scroll` or during `select`.
- Rechecked Embla v8 behavior: touch-drag settle duration is determined by drag force; the public `duration` option only affects API-triggered scrolls, so changing the existing `duration: 22` would not directly shorten finger-drag settling.
- Added a regression requiring rapid consecutive selected snaps to update the visible calendar date immediately while the heavy render window stays fixed until `settle`.
- Behavioral red: Quality Gate run 706 failed the new fast-swipe/prewarm regression on the existing perf branch.
- Restored `focusDate`/header synchronization on `select` while tracking the in-flight swipe separately so `focusIndex` does not widen the heavy render window mid-animation.
- Kept the three-grid cold mount, then idle-prewarmed the active person's calendar to five grids (current ±2). Inactive person panes stay at the smaller ±1 window.
- Focused Quality Gate run 708 passed.
- First full run 709 exposed two React lint violations in the follow-up implementation: synchronous state reset inside an effect and reading a ref during render.
- Reworked those mechanics without changing the candidate behavior: prewarm is now derived from active/prewarmed state, and in-flight swipe ownership is React state rather than render-time ref access.
- Repair Quality Gate run 710 passed focused checks.
- Full run 711 passed checks/build/DOM but browser shard 1 caught a stale performance assertion that capped the post-idle active Calendar at three rendered grids. The implementation intentionally prewarms that active window to five; the cold three-grid bound remains covered by the hook regression.
- Updated the browser contract to allow the documented post-idle five-grid active window and updated PROJECT_REFERENCE.md §16 to make the two-stage three→five Calendar window authoritative. The intermediate [verify:browser] run was superseded/cancelled by the immediate documentation commit, so the exact final SHA still needs full browser acceptance.

## Constraints
- Preserve direct-manipulation dragging, calendar gesture ownership, Month/Week visuals, and the smoother no-heavy-mount settling behavior from the first perf candidate.
- Do not enable Embla `skipSnaps`; the fast-swipe regression is new behavior from deferred state synchronization, not the long-standing one-snap-per-interaction policy.
- Do not use Embla `duration` as a proxy for touch settle speed; v8 documents drag interactions as force-driven.
- Keep cold-mount work bounded: only the active person's calendar may widen to ±2, and only after idle.
- Do not merge the perf branch into `dev` without separate explicit instruction.

## Verification
- First perf stable branch: `89c8d4e50fc834cc0a5a0d9b7c75f61a8d8797c6`; Quality Gate 705 passed and Vercel Preview was READY.
- Manual feedback on first perf Preview: settling was smoother, but rapid repeat swipe responsiveness regressed and perceived settling was too long.
- Follow-up behavioral red: run 706.
- Follow-up focused green: run 708.
- First full run 709: failed checks on two React lint errors; no runtime/test failure was accepted.
- Repair focused green: run 710.
- Full run 711: runtime/static/DOM/build passed; browser shard 1 failed only the stale <=3 post-idle grid-count assertion.
- Browser-contract assertion and durable §16 architecture contract updated for cold three-grid / active idle-prewarmed five-grid behavior.
- Exact final follow-up canonical acceptance: pending on this final checkpoint.
- Updated stable perf Preview: pending.
- Real-device Month/Week acceptance: pending after updated Preview.

Next action: run full canonical acceptance on the exact follow-up task SHA, squash-merge it into `perf/calendar-swipe-settling`, verify stable CI and Vercel, then repeat the real-device Month/Week rapid-swipe/settle check.

Blockers: none.
