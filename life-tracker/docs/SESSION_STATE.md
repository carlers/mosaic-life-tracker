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
- DOM regressions added for whole-pill hold, move-after-hold, click suppression, swipe/cancel, native context menu cancellation, real category editor and keyboard options.
- Audit also found and fixed a persistence race: reversing a still-pending reorder had been skipped because the new order matched stale input props. Keep an in-flight write count, queue the reversing commit, and prevent failed older commits from rolling back newer intents.

## Verification / next action
- Initial focused CI #39300133082 had 1919 passing tests and one test timeout from fake-timer leakage, now corrected. Follow-up #39300772803: 120 passing/1 failing selected tests because the mock category did not forward contextmenu even though the real UI does; fixed harness wiring. No production source failure identified in either run. Final task focused CI and stable full acceptance are pending; manual device/hosted revision not yet checked.
- Commit this coherent task with `[verify:focused]`; after green, squash PR into existing stable Preview; confirm exact-SHA full CI, trusted Vercel Preview, Scratch target/host before owner iOS/Android re-test.
