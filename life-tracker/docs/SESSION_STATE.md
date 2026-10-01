# Session checkpoint

Updated: 2026-10-01
Current task: Polish Day View gesture arbitration so desktop mouse day-swipes can start from task text without weakening long-press task reorder.
Status: The prior category-boundary jitter polish is manually accepted on Samsung/PWA. The mouse-swipe repair is implemented on `chatgpt/polish-task-mouse-day-swipe`. The first full run exposed only a regression-fixture mistake: the real Day View probe is intentionally mounted only with `?perf=heavy`; the test now opens that fixture correctly. Exact-SHA full verification is rerunning before promotion.
Next action: Run exact-SHA canonical verification, repair any failures, squash-promote to `feature/task-reorder-clean`, verify Vercel READY, then manually confirm quick mouse drags over task title/memo change days while a stationary 500 ms title hold still reorders.
Blockers: None.

## Accepted baseline
- `77c6e381643d6b7f864baac922f110c2d39c6cc4` remains the rollback point before category-boundary visual polish.
- `9cee1ac448212fdbeb917a68bfce9ba26f35fe56` contains the accepted jitter fix.
- `5d9ae331ac4d98620ac949258f8ff9443f91c4a9` is the latest stable checkpoint commit before this mouse gesture polish.
- Fresh-open task rendering, legacy multi-task rendering, same/cross-category reorder, consecutive drags, and category-boundary visual stability are accepted.

## Mouse swipe root cause
- Swiper 14 treats `button` as a focusable element by default.
- Task titles are semantic buttons and `useBubbleGestures` captures their pointer so multi-tap/long-press behavior remains coherent.
- On mouse-down, the title becomes `document.activeElement`. Swiper's pointer-move handler explicitly returns when the move target is the focused element and it matches `focusableElements`.
- The task title therefore trapped desktop mouse drags before Swiper could move, while non-focusable category/background surfaces swiped normally.
- dnd-kit's reorder sensor was not the blocking layer: it uses a 500 ms delay and cancels when movement exceeds tolerance before activation.

## Fix
- Task title and inline memo text are marked as explicit Day View swipe-through controls.
- The Day View Swiper keeps normal focus protection for inputs and ordinary buttons, but excludes only those marked task text controls from its internal `focusableElements` guard.
- Quick mouse movement over task text is therefore owned by day navigation.
- A stationary 500 ms hold on the title still activates dnd-kit reorder; once reorder is active, Day View disables Swiper movement as before.
- Completion checkbox, task image, edit input, reactions, and other dedicated controls keep their existing pointer isolation and remain control-owned.
- No task reorder persistence, collision, overlay, or optimistic-placement logic changes.

## Verification
- Added a browser regression that opens the real Day View sheet and mouse-drags left directly from a task title; the active day must advance and no drag overlay may appear.
- Existing touch long-press reorder and active-reorder sheet-lock coverage remain in place.
- Full canonical verification and stable Preview promotion remain.
