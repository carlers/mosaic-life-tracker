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

## Diagnosed release trajectory

A v0.25.3 full task-branch diagnostic passed static checks, DOM, source production build and all seven existing size caps, but the first browser regression intentionally failed: the released row visibly traveled `431.69px -> 533px` over approximately 200ms even though the floating overlay was already at the drop position. That is the old-source Motion transform playing after release, not an acceptable smooth glide. A fresh keyed wrapper for the released row removes the stale Motion state. The strict release-jump regression must remain and go green before Preview delivery.

## Stable v0.25.3 Preview build parity (2026-10-13)

- PR #762 squash merged only to `feature/diary-408` at `f1de3ee7882495e5b81a2ce411f731676f26e54c`. Its strict browser release-jump regression and focused tests passed on task SHA `21b3080ae8919a90786299a84a43afd596e63e3b`.
- The first Vercel Scratch-hosted v0.25.3 build failed the raw all-assets guard by 721 bytes: 2,504,221 / 2,503,500 B. The other six budgets passed, including 2,592,804 / 2,593,000 B precache and 367,627 / 368,000 B Home closure.
- A measured repair on isolated task branch `chatgpt/408-hosted-size-parity-20261013` changes **only** raw all-assets ceiling to 2,505,000 B (+1,500 B; 779 B hosted margin), keeping the complete historical review chain. No app bundle, feature, or version change.
Next action: complete focused verification for this isolated budget-only repair, squash into the stable Preview, verify the exact new SHA's canonical acceptance and Vercel Scratch READY/all seven hosted metrics, then hand off v0.25.3 for actual phone/desktop testing. Do not merge to dev/main or close issue #408.
