# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #859 owner Day View category reorder — long-press/touch reliability follow-up.

## Source boundary
- Accepted original stable Preview: `feature/dayview-category-gesture-859-20261020@100b50da27a178ae8d648da7144461a62bccf019` (v0.31.0).
- New scoped task branch: `chatgpt/859-longpress-audit-20261020` (candidate v0.31.1).
- Only frontend gesture and regression tests; no schema, backend, auth, provider or Production changes. No dev/main promotion approval.

## Audit and implementation
- A stationary touch hold previously called Framer Motion dragControls.start at the same instant as opening the Edit popup; possible immediate dismissal and stale React pointer event.
- Long-press was bound only to the label rather than the full category pill; plus/padding could never show the edit bubble.
- Revised to open the popup after a stationary hold and start drag only on subsequent deliberate movement from the label using the current pointer event.
- Suppress the synthetic click following a hold until it is actually consumed, instead of expiring a 100ms timer; cancel pre-hold movement and pointer cancellation.
- Avoid initiating category gestures during inline category/task editing or add-task input; preserve tap-add, selection mode, owner-only gate and native scroll outside drag label.
- DOM regressions added for whole-pill hold, move-after-hold, click suppression, swipe/cancel, real category editor and keyboard options.

## Verification / next action
- New task implementation is pending focused CI and full stable-Preview acceptance. No real-device gestures or hosted revision acceptance claimed.
- Commit this coherent task with `[verify:focused]`; after green, squash PR into existing stable Preview; confirm exact-SHA full CI, trusted Vercel Preview, Scratch target/host before owner iOS/Android re-test.
