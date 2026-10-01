# Session checkpoint

Updated: 2026-10-01
Current task: Polish Day View gesture arbitration so desktop mouse day-swipes can start from task text without weakening long-press task reorder.
Status: Automated implementation and delivery are complete on `feature/task-reorder-clean`. Stable commit `8a25971506c33ac9f7928bfe9aff2cd093d74dd6` passed the full canonical Quality Gate and its Vercel Preview is READY. Manual desktop acceptance of the mouse gesture remains.
Next action: On the stable Preview, quick-drag left/right with a mouse directly from a task title and inline memo and confirm the day follows the cursor. Then hold a task title stationary for 500 ms and confirm normal task reorder still activates.
Blockers: None.

## Accepted baseline
- `77c6e381643d6b7f864baac922f110c2d39c6cc4` remains the rollback point before category-boundary visual polish.
- `9cee1ac448212fdbeb917a68bfce9ba26f35fe56` contains the accepted category-boundary jitter fix.
- The category-boundary polish is manually accepted on Samsung/PWA.
- Fresh-open task rendering, legacy multi-task rendering, same/cross-category reorder, consecutive drags, and category-boundary visual stability are accepted.

## Mouse swipe root cause
- Swiper 14 treats `button` as a focusable element by default.
- Task titles are semantic buttons and `useBubbleGestures` captures their pointer so multi-tap/long-press behavior remains coherent.
- On mouse-down, the title becomes `document.activeElement`. Swiper's pointer-move handler returns when the move target is that focused element and it matches `focusableElements`.
- The task title therefore trapped desktop mouse drags before Swiper could move, while non-focusable category/background surfaces swiped normally.
- dnd-kit's reorder sensor was not the blocking layer: it uses a 500 ms delay and cancels when movement exceeds tolerance before activation.

## Fix
- Task title and inline memo text are explicit Day View swipe-through controls.
- The Day View Swiper retains normal focus protection for inputs and ordinary buttons, but excludes only those marked task text controls from its internal focusable-element guard.
- Quick mouse movement over task text is owned by day navigation.
- A stationary 500 ms hold on the title still activates dnd-kit reorder; once reorder is active, Day View disables Swiper movement as before.
- Completion checkbox, task image, edit input, reactions, and other dedicated controls keep their existing pointer isolation and remain control-owned.
- Task reorder persistence, collision, overlay, optimistic placement, and lifecycle code are unchanged.

## Verification
- Task-branch full Quality Gate passed on `ab232542b8b92881e82f8080abbf72272d6ccf23`.
- Stable feature full Quality Gate passed on `8a25971506c33ac9f7928bfe9aff2cd093d74dd6`, including both Chromium browser shards and canonical acceptance.
- Browser regression opens the real Day View sheet, mouse-drags directly from a task title, verifies the active day advances, and verifies no task drag overlay appears.
- Existing touch long-press reorder and active-reorder sheet-lock coverage remain green.
- Vercel deployment `dpl_HkQyLVkHYn6WKNrRBLn5YXAfELyd` is READY on the stable feature alias.
- Manual desktop mouse acceptance has not yet been claimed.
