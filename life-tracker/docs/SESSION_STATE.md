# Session checkpoint — #408 Diary relative ordering and top insertion

Updated: October 15, 2026. Base stable Diary Preview v0.25.4 `feature/diary-408@d29340395c82cff91a5a1f9fecc582d727fb320d`. User manually accepts other Diary behavior; reported two outstanding Day View drag/order defects.

## Approved behavior
- Diary placed just below a category pill must offer a real before-card insertion target for ordinary task drag; support after-card too, with no permanent visible spacer and no new ghost/animation regressions.
- Diary must participate in the mixed task order, not occupy a perpetual numeric slot: new tasks/reorders above it move its index naturally; crossing a task past Diary moves the relative position; category moves and deleted anchors have bounded fallback.
- Preserve default top/bottom modes, task-only order persistence, category labels, diary drag overlay/settle, account-synced per-day settings, old saved slots, touch input, and shared Scratch Function.
- Isolated PATCH Preview v0.25.5; no Appwrite schemas, Function, Scratch writes, Production or dev/main promotions.

## Implementation
- `src/lib/diaryPlacement.ts`: before/after existing-task anchors with safe fallback, automatic legacy slot upgrade and crossing-aware task reorder calculation.
- `TaskReorderSurfaces.tsx`, `taskReorder.ts`, `CategorySection.tsx`: unique before/after drop zones covering the real diary card, even when no gap exists at the top.
- `TaskReorderRuntime.tsx`, `DaySlideContent.tsx`: optimistic mixed ordering while task drag projects and after commit; account/day-scoped settings upgrade only with a real task anchor available.
- Unit regressions in `tests/unit/diaryPlacement.test.ts` and `tests/unit/taskReorder.test.ts`.

## Verification/promotion
- Task branch `chatgpt/408-diary-relative-order-20261015`; focused CI, then stable `feature/diary-408` full canonical + Vercel READY. User device acceptance of drag before/after diary, cross/within category moves, task insertion, Diary drag, re-open, sync, cancellation and fallback still required. Do not merge into dev before approval.
