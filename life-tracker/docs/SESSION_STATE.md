# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: #1245 v0.43.6 nested-sheet Day View task/category visual jitter.

## Baseline and user feedback
- Stable Preview `perf/1245-nested-sheet-diary-exit-v0433-20261022@2a4a9a942f67538083961f2fb2a8af13c281d89c` v0.43.5: canonical Quality Gate #39787667633 SUCCESS; Trusted Preview Delivery #39788338200 attempt 2 SUCCESS; exact-SHA Vercel READY `dpl_9Dke8r17NHBEB4iNrioNLhxD9hMx`.
- `dev@ebbc9a1e01c4380af13ed2c913bed17fba905892` v0.43.2; no dev/main/Production approval. Issue #1245 open.
- Owner confirms row jitter persists in Memo, Task Actions and Add Photo, so v0.43.5 row identity stabilization was not a complete animation fix. Task Action height remains out of scope.

## Root cause and proposed scoped repair
- Under nested sheets, the shared BottomSheet still scales the *entire* Day View ancestor 1 -> .985. The Day View contains Framer Motion LayoutGroup, Reorder.Item and dynamically registered task droppable wrappers, whose layout projection measures descendant geometry while the parent is changing scale. This is a strong source-based explanation for visible row jitter despite preserved DOM node identity.
- Introduce `BottomSheet.scaleBehind` (defaults true; no global behavior changes) and set it false on the *Day View shell only*. Day View stays at native scale beneath nested Memo/Task Actions/Add Photo; nested backdrops still show depth, upper sheet enters/exits normally, and inert/back/focus/drag/history remain unchanged. This trades parent-scale depth for geometry stability specifically on layout-sensitive Day View.
- Add browser regression sampling task/category bounding rects across the real nested Memo entrance, not just DOM identity; existing modal inert and close/Escape checks remain.
- No change to Task Actions position/height, app/backend data, task/reorder gestures, upper-sheet animation duration, or global scale defaults. v0.43.6 version triplet.

## Delivery
- Task branch `chatgpt/1245-dayview-nested-motion-stability-v0436-20261022` from accepted `2a4a9a9`; focused [verify:browser], squash into stable Preview when green; then canonical Quality Gate and exact-SHA Vercel READY. Manual mobile visual acceptance remains required, performance gains not claimed.
