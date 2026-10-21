# Session checkpoint

Updated: 2026-10-21 UTC
Current task: issue #404 — v0.40.4 split-panel animation, month snap and full-height repair.

## Source of truth
- Task branch: `chatgpt/404-resize-root-cause-20261021`, PR #1184 against stable Preview `feature/split-day-panel-dev-404-20261021` at `08c7a003af04121c50de60b7bdd37eef73efd782` (v0.40.3).
- `dev` baseline on this topic remains `e1c90b387ecfb4e29d64c88b6557703dd23ca207`; no approval to merge `dev`, `main` or Production.
- User feedback: left-side month grid offset; divider resize and panel expansion/collapse visibly shake; both height modes must fill to workspace bottom, even for shorter month grids. Screen-height includes Home header/search/person chrome in calendar column; grid-height begins below chrome.

## Root cause and task implementation
- Previously selected initial month was the only browser snap assertion; geometry was tested only after settling. PR #1184 adds real Embla tests after navigating to month 31, with ResizeObserver paint-alignment samples while opening, pointer-dragging and closing on left/right in both height modes.
- Dynamic panel width had multiple competing snaps while Embla cached track sizes; during width motion, the focused slide is now bound to viewport-width CSS; Embla automatic resize reinit is suppressed only for panel motion. One final reinit runs at settled geometry.
- Pointer resize is coalesced with animation frames and width easing is disabled during pointer capture. Inspector height measures Home workspace bottom without changing its top position in grid mode.
- Production-build CI on task SHA `c75d2a4c9d6fdb83adfd50168b1da2b67d5291f4` failed only Home closure 381023/381000 (+23 gzip bytes); static, DOM and browser shard 1 passed. Browser shard 2 did not reach its alignment assertions: all four tests found workspace minus calendar bottom = 0 rather than >100.
- Repair: test-only fixture used Tailwind utility `h-[470px]` not emitted for the isolated test harness; use an explicit inline 470px height so the negative-height case exists in the browser. Avoid the nonessential month-render week-boundary computations in `useCalendarState` to recover production-size headroom without changing calendar presentation or size gates.

## Next action
1. Rerun exact task SHA Quality Gate and inspect both browser shards plus blocking production size; repair any actual geometry failure without relaxing the alignment assertions, security gates or build ceilings.
2. After task focused/full gate succeeds, squash through PR #1184 into the existing stable Preview; verify canonical full Quality Gate, exact-SHA trusted Vercel READY and provide the new Preview URL.
3. Manual authenticated large-screen/device acceptance remains outstanding: left/right, both heights, open/close, divider, changed month, owner/friend, keyboard, zoom/reduced motion, nested modals, Back/Escape, and narrow fallback. Do not merge Preview to dev/main without explicit approval.
