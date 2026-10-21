# Session checkpoint

Updated: 2026-10-21 UTC
Current task: issue #404 — repair user-reported split Day View inspector geometry, motion and regression coverage on top of unpromoted Preview v0.40.3.

## Verified baseline and scope
- Source branch `feature/split-day-panel-dev-404-20261021@08c7a003af04121c50de60b7bdd37eef73efd782` (v0.40.3), official full Quality Gate 39575786087 SUCCESS and trusted Preview Delivery 39576165274 SUCCESS. User reports left inspector still half-scrolled, severe drag/open/close jitter and grid-mode inspector cut short.
- `dev@e1c90b387ecfb4e29d64c88b6557703dd23ca207` remains separate; no dev/main/Production promotion approved. New task branch `chatgpt/404-resize-root-cause-20261021`; recommended next Preview candidate PATCH v0.40.4.

## Diagnosed defects
- DayDetailPanel animated the *same width* with a 300ms easing during pointer dragging. Its inner fixed-width content and outer animated host diverged while React state and Embla continually remeasured.
- Embla's automatic ResizeObserver reInit plus 85ms delayed observer snap, pointer-commit snap, pointer-end snap and transition-end snap competed during moving geometry. A reInit/snap that eventually aligns after settling does not prove visually stable frames.
- Grid-mode panel height was derived from the calendar host frame, not the workspace viewport bottom; the inspector therefore ended wherever the month grid ended.
- Previous Playwright only validated slide 30 at idle and matched grid-mode panel to the incorrect shorter calendar frame, rather than observing animation frames or navigating first.

## Candidate implementation and verification required
- Suppress Embla's automatic resize reInit only while a panel owns its layout, project the focused slide transform during live viewport resize, and run one full reInit after transitions/drag settle. Coalesce pointer moves to animation frames and disable easing while pointer held. Observe Home workspace bounds and grow grid-mode inspector down to workspace bottom.
- Real-browser contract now navigates to index 31 first, checks both sides and modes, samples every animation paint for opening/dragging/closing, and uses deliberately shorter grid height to expose former false-positive bottom check.
- Stage candidate on task branch; run strict canonical browser/build/size tests, fix any errors, then squash to stable feature Preview branch only after green and verify trusted exact-SHA READY. Manual authenticated desktop/physical device acceptance still unperformed; keep #404 open. Do not promote to dev/main/Production without approval.
