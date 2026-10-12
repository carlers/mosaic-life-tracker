# Session checkpoint — Mosaic issue #408

Updated: 2026-10-13.
Current task: v0.25.3 follow-up refinement on isolated branch `chatgpt/408-smooth-drop-parity-20261013`, based on last READY stable Preview `feature/diary-408` at `c7d1af230e6a40b0c1341edf900e8034b8ef8d66`.
Next action: verify full build-size and browser release trajectories for v0.25.3, repair measured budget/test failures, squash focused-green branch only into `feature/diary-408`, verify exact-SHA canonical CI and registered Vercel Scratch Preview READY, then request device acceptance. Do not merge to dev/main or close #408.

## v0.25.3 implementation

- Diary's dnd-kit real-card feedback uses `move` without an old-flow placeholder, while the task/diary common projection renders exactly one height-matched insertion gap beginning on lift. The full actual diary card still follows the finger rather than a substitute overlay.
- Both diary source slot and task source row turn off their own Framer Motion layout projection at release/cancel and re-enable it after the new React DOM has painted, avoiding a backward/forward FLIP of a previously out-of-flow source. Neighboring row/category reflow remains animated.
- Preserves task-specific existing overlay and optimistic persistence; preserves diary default/slot placement, stationary-pointer collision stabilization, cancel/outside behavior and accessibility.
- Browser regression samples the released task row's animation-frame Y positions and fails large up/down excursions. Manual parity checks include long/short diary heights, source/one-gap behavior, populated/empty/collapsed categories, release, cancellation and multiple consecutive drags.
- Preview candidate version: PATCH v0.25.3. Frontend-only; no schema or Function modification.

## Required verification (pending, not claimed)

- Run dedicated task diagnostic/full production build because existing v0.25.2 hosted total-assets cap had only 18 B of headroom. Use measured review, not unbounded budget exemptions.
- Focused GitHub tests, stable branch full canonical gate, Vercel exact-SHA Scratch READY, and device/desktop drag acceptance all remain required.
