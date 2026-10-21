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
