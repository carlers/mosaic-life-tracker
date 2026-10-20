# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #951 — Final Timeline audit and authorized Preview → dev promotion.

## Authority / baseline
- User authorized final cleanup/polish, double-check and merge to dev; NOT dev → main or Production.
- Accepted prior stable Preview: `feature/dayview-timeline-951-20261020@cd07daa80e551d2d1e0854f859572164f6bebb45` v0.36.2.
- Exact CI: https://github.com/carlers/mosaic-life-tracker/actions/runs/39451144577 SUCCESS; trusted Preview https://github.com/carlers/mosaic-life-tracker/actions/runs/39451434739 SUCCESS; Vercel READY.
- Starting dev: `0606ff3aebf565cd47f1fe9bc4e53cf64a1499a0` v0.34.4; main `c938c825370f8270b46f19119b06a1f74d35842b` v0.29.1. Independent ongoing previews remain unpromoted.
- Final audit task branch: `chatgpt/951-final-audit-menu-clipping-20261020`, based on accepted stable Preview. User-testable polishing PATCH candidate v0.36.3.

## Final audit findings / changes
- Custom category menus were absolutely positioned inside Day View's `overflow-y-auto` scroll container; could be clipped at mobile edges.
- Lift popup to a viewport-positioned React portal with available-space/up-or-down placement, edge clamping, bounded height and internal scroll. Preserve keyboard Home/End/arrows/Escape, focus-return, outside-pointer dismissal, stop nested Swiper ownership, and close on parent scroll, resize and external focus.
- Focused DOM regressions for Timeline category filtering, add-task category preservation and action, keyboard open/Escape and sort-basis callback.
- Do not change task identity, account-sync, categories, manual task order, owner/friend privacy or existing category layout.
- Size-gate headroom from v0.36.2 build: initial closure 5.6 KB, home closure 4.4 KB (blocking). New code stays lazy Timeline chunk; size must be reverified.

## Verification / delivery
- Final coherent task commit `[verify:focused]` with this checkpoint and v0.36.3. Fix focused failures on task branch.
- Squash approved refinement into the SAME stable Preview, rerun exact full canonical CI and trusted Vercel READY.
- Once accepted, use a reviewed stable Preview → dev PR with exact accepted tree and explicit merge subject/body. Confirm dev push's promotion/CI result and dev branch SHA. No dev → main/production actions.
- Outstanding manual only: real Android/iOS touch, menu clipping in varying keyboard/viewport sizes, dark/light/black, authenticated Scratch login, cross-device sync. Do not claim tests not run.
