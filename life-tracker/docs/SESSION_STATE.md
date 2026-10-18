# Session checkpoint

Updated: 2026-10-18 UTC
Current task: Mosaic issue #858 — behavior-preserving native static Todo row / offscreen dnd projection candidate, with Calendar still in scope.

## Approved boundary
- Continue performance optimization research and implementation after causal diagnostics. Keep #858 OPEN; no stable Preview, dev/main, Production, or 1.0 promotion without owner approval. Accepted `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` v0.29.8 is unchanged. Candidate branch forks exactly from this dev SHA, **not** from any synthetic lab code.
- Preserve cached offline auth/data, cross-user owner isolation, full task history availability, Day View/Diary/shared/photos/selection, drag/scroll geometry, accessibility, colors and UI appearance. No backend or schema migration.

## Verified diagnostic evidence
- [Synthetic near-viewport Motion #39104388237](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388237) SUCCESS 72/72: Todo 1000 same-day startup 1580→1402ms with suppress far-offscreen Motion layout + unregistered passive target markup; 250 895→834ms; 25 634→616ms. First touch long-press/overlay/cancel passed Chromium at 25 rows.
- [Native static TaskItem #39105911960](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105911960) SUCCESS 72/72 plus [focused #39105911880](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105911880) SUCCESS at `chatgpt/858-native-task-frame-lab-20261018@51d216b797f323690bcd60ae22ce5013cb7dfd3e`. Same-bundle slow-online cached PWA 2×CPU n=3 Todo owner-ready p50 baseline vs combined native+near offscreen: **25 499→468ms; 250 669→603ms; 1000 dense 1221→951ms; 1000 across month 684→662ms**. Offline 1000 dense 1250→983ms. Full task DOM counts maintained, 25-task first long-press and cancel succeeded baseline, native, near and combined variants. These synthetic measurements do NOT prove installed-phone performance, gesture sweep, complex mixed content, or first paint.
- [Query prewarm #39105689490](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105689490) SUCCESS 84/84 but **REJECT**: owner full-history query pre-execution after DB ready yielded inconsistent marginal wins, often did not complete ahead of Home subscription; redundant main-thread/IndexedDB competition.
- [Date-window-only query ablation #39106414352](https://github.com/carlers/mosaic-life-tracker/actions/runs/39106414352) underway on synthetic lab branch `chatgpt/858-windowed-query-lab-20261018@0db4b837468dc1ca8374c4c9db248014eca2f5b2`; deliberately breaks distant-date loading/search, NEVER ship as-is.

## Current implementation candidate
- Branch `chatgpt/858-task-row-native-candidate-20261018`, clean fork of dev v0.29.8. Two narrowly changed runtime files, no lab flags:
  - `TaskReorderSurfaces.tsx`: omit two inert DOM targets when proximity observer already determined a row is not registered with dnd-kit; when near/active, render exact registered before/after targets. Keep Motion position animation on registered/active rows, disable it for far rows.
  - `TaskItem.tsx`: when `disableLayoutAnimation` is already true (including draggable Day View), render native `div` instead of initializing a Framer Motion instance. Keep the animated Motion element for all enabled-animation paths and drag overlay. Shared DOM props/classes/styles/content/events are identical.
- New browser behavior regression `tests/e2e/interaction-contract.spec.mjs`: legacy RxDocument real rows remain visible before drag; scroll to last distant row, first long-press produces actual overlay, cancellation leaves all rows intact. Existing browser-contract tests cover first drag, sibling projection/release, repeated moves, task controls and undo.
- This **is a candidate, not accepted**. Normal phone/touch, variable-height diary/photo/shared, category reorder and scroll interactions need verification; compare performance independently without CI flags, and require stable Scratch Preview canonical/Vercel READY + owner manual acceptance before any dev/main promotion.

## Next action
- On task branch commit scoped candidate and checkpoint, run focused and browser correctness CI, inspect failure root cause and repair. Do not promote. If browser passes, create a product-source same-runner A/B without test-only branches and coordinate stable Preview authorization with owner.
- Finish and interpret independent read-only date-window diagnostic; any real windowed reader needs two-tier all-history behavior and strict owner switching, no silent omission. Calendar startup remains priority along with Todo, #858 stays OPEN. Security #936, backend #914 separate mandatory 1.0 gates.
