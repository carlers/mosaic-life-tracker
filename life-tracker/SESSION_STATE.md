# Session state

Updated: 2026-09-23
Current task: Day View direct-manipulation follow-up and animation scheduling review
Status: in progress.

## Active user prompt

> are we using requestanimationframe to make things smooth? this applies to all animations. tell me if we shuold or not or if its worth doing. also the date header can be swiped horizontally but it doenst get dragged horizontally during the drag gesture

## Parent prompt

> check repo for cureent state on preview branch. next task: swipe area should be entire dayviewsheet, not js the part with categories and tasks. opening a chat shouldnt autoopen the keyboard of a phone. in todolist view and calrndar view swiping through months feels a little low fps, feels like animations are capped at 60fps or smth even tho my phone is at 120 fps, can we optimize.

## Progress

1. **Done — recover deployed baseline.** Confirmed Preview and the prior task branch at `f80927eb4490f5e7dc2e557e910e9aa2e0bed9a6`; prior Verify/Preview rollout is complete.
2. **Done — animation scheduling assessment.** No blanket app-level rAF layer is warranted: browser/CSS compositor animation, Swiper, Embla, and Framer already schedule frame work. Continue reducing React/state work on frame-critical paths instead of double-scheduling animation callbacks.
3. **In progress — direct-manipulation regression.** The deployed Day View date row is inside Swiper but is marked `swiper-no-swiping` and immediately hands pointer-down to BottomSheet vertical drag; the sheet-wide fallback only changes day after release, so the header cannot visually follow the finger.
4. **Pending — spec-first browser coverage.** Add an integrated BottomSheet + Swiper contract proving the date/navigation row translates during an in-progress horizontal touch while vertical drag-to-close remains available.
5. **Pending — implementation.** Add direction arbitration for the shared date-row gesture, let Swiper own horizontal direct manipulation, and preserve the existing sheet-wide fallback only for non-Swiper exposed sheet areas.
6. **Pending — acceptance and Preview rollout.** Run canonical Verify, fix failures, fast-forward Preview to the exact green checkpoint, verify deployment, and record the remaining real-device check.

Roadmap pointer: scoped interaction follow-up; no roadmap checkbox changes.
Blockers: None.
