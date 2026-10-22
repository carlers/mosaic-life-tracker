# Session checkpoint
Updated: 2026-10-22 Asia/Manila
Current task: #1245 Memo overlay background task/category remount jitter; v0.43.5 Preview candidate.

## Verified baseline
- Stable Preview `perf/1245-nested-sheet-diary-exit-v0433-20261022@bcdf46312c8ea1ca283f35eaf144f8aa6fb9f8be` v0.43.4 accepted; canonical Quality Gate #39780745085 and Trusted Preview Delivery #39781326892 SUCCESS; Vercel Preview `dpl_62k42XAHH7p188tEsQW27MQXnTky` READY.
- `dev@ebbc9a1e01c4380af13ed2c913bed17fba905892` v0.43.2 unchanged. No dev/main/Production promotion authorized. #1245 open.
- Owner confirms late parent-scale settling is improved, reports visible task/category jitter underneath when Memo opens. Task Action Sheet height/position explicitly out of scope.

## Root cause and scoped fix
- In sheet-mode Day View, opening any nested modal sets `isBackgroundLocked`. That formerly forced `reorderEnabled=false`, replacing `DayViewCategoryReorder`'s `Reorder.Group/Item` with fragment-based rows and switching `CategorySection` from registered header/task drop surfaces to plain ones. This remounted category and task DOM while the background visibly scaled down, producing flashes/jitter.
- Keep `reorderEnabled` structurally stable under a nested modal in `renderMode='sheet'` only. The shared parent `BottomSheet` already handles nested `inert`, pointer-events lock and focus ownership; active selection/edit/drag guards remain. Non-sheet modes retain existing background-lock behavior.
- Browser test against real DayViewSheet Memo path asserts category/task nodes remain attached and identical while Memo opens, parent remains inert, Escape close preserves rows.
- Version 0.43.5 across package/package-lock/appVersion. No change to Task Action height, shared sheet motion, data/backend, category reorder gesture semantics or performance budgets.

## Delivery
- Isolated task branch `chatgpt/1245-memo-background-row-stability-v0435-20261022` based on `bcdf463`. Request `[verify:browser]`, squash onto current stable Preview after task check green, require canonical Quality Gate and trusted Vercel exact-SHA READY. User/phone visual acceptance outstanding. No dev/main/Production promotion.
