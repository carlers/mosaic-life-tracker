# Session checkpoint
Updated: 2026-10-21 UTC
Current task: #404 v0.40.3 — left panel alignment, full height and expand/collapse

## Authority and scope
- Source: stable Preview `feature/split-day-panel-dev-404-20261021@299e52e4faa3fad84128d09291e3ec2236c0fd7f` (v0.40.2), canonical gate 39563186794 SUCCESS; trusted Vercel READY dpl_4Guk7JPFBJo1DZPyrLwqZxdaiodq. `dev` remains `e1c90b387ecfb4e29d64c88b6557703dd23ca207`. Issue #404 remains open.
- User screenshot from this exact Preview confirms persistent left-side month viewport/weekday misalignment, inspector ending halfway up the month grid instead of filling its allocated height, and fade-in animation instead of requested expansion.
- Requirement: restore focused month snap even if Embla's transient selected snap differs; panel height fills actual Calendar workspace (grid) or complete Home workspace down to shared nav (screen); smooth width expansion and collapse while retaining edit state and accessible resize controls, and no visual fading. Preserve default BottomSheet, owner/friend behavior and account preferences.

## Implementation / verification target
- `useCalendarState` uses focused month index on post-layout reInit rather than Embla's potentially stale selected index. Reuse focusIndex in jump effect, add unit regression forcing stale index 29 while correct focus is 30.
- Lazy inspector measures the actual frame's width and **height** through ResizeObserver and applies explicit height instead of relying on percentage height in nested flex children; Home portal slot is positioned. Expand/collapse wrapper width over 300 ms with cubic easing and fixed-width inner inspector content; no opacity changes. Preserve drag and keyboard splitter, reduced motion, closing inert state and history, and resnap after close completes.
- Add real-browser viewport/snap/height and transition regression in the existing interaction harness; PATCH version 0.40.3.
- Task branch `chatgpt/404-left-snap-expand-height-20261021`; focused then squash into stable Preview, full canonical gate and trusted exact SHA READY Vercel. Do not relax Home bundle or CI thresholds, promote to dev/main or touch Production. Manual device visual acceptance still required.

## Browser-discovered root cause and repair
- Task run [39565613745](https://github.com/carlers/mosaic-life-tracker/actions/runs/39565613745) included first real desktop Playwright split-panel tests. **Screen-height left** passed; **grid-height left** failed, exactly **412 CSS pixels** misalignment after inspector opened — the 400px default panel plus 12px divider. This repro proves the prior re-snap-only attempts did not fix grid flex-reversal geometry.
- Replace grid-height `flex-direction:row-reverse`/:has placement with genuine DOM panel-first order for left (and panel-last for right), keeping the calendar viewport's own track in normal LTR flex flow. Retain Home-level screen portal CSS, the focused-month reinitialization and explicit measured panel height. Old mocked DOM style tests updated for pixel height and width-expansion semantics (not loosened browser alignment tests).
- Rerun focused/browser task gate at repaired SHA before canonical Preview promotion.

## Divider browser regression and repair
- Browser [39566297902](https://github.com/carlers/mosaic-life-tracker/actions/runs/39566297902): **both initial opening modes aligned** with actual DOM-order correction. Grid-height left failed only *after dragging divider*, exactly 412px offset; screen-height left passed. Mock DOM test still assumed a synthetic TransitionEvent propertyName; update same-host handler for single width transition.
- Root cause is duplicate manual `emblaApi.reInit()` after native Embla watchResize has already recalculated viewport geometry, causing an extra track translation on left dragging. Preserve focusDate-based scrollTo but remove redundant reInit. Keep unit assertion that stale selected index cannot override focused month and that manual reinitialization is not issued. Keep strict real-browser alignment-after-drag assertion.

## Third browser investigation
- Browser [39566839309](https://github.com/carlers/mosaic-life-tracker/actions/runs/39566839309) still revealed +402px grid offset on initial open and +10px in screen mode after divider drag without redundant reinit. To distinguish snap-list caching from CSS geometry, force one Embla reInit with explicit focused-month `startIndex` at settled layout; add compact viewport/track/slide rectangle and transform diagnostics to browser case. Do not weaken assertion on exact selected month edges.
