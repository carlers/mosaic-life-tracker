# Session checkpoint

Updated: 2026-10-18 UTC
Current task: #858 structural Calendar/Todo startup performance; Todo static native task-row candidate.

## Approved boundary
- Issue #858 stays OPEN. Accepted `dev@bfb0fff0c1c283f599f32db8c2a426416fa65e7b` v0.29.8 unchanged. No stable Preview/dev/main/Production/1.0 promotion approval; no backend or version change.
- Preserve offline/auth isolation, all dates/tasks, Diary/shared/photos, first drag, scroll/reorder, accessible actions and existing UI.

## Measured evidence
- [Near-viewport Motion #39104388237](https://github.com/carlers/mosaic-life-tracker/actions/runs/39104388237) 72/72 SUCCESS: Todo dense 1000 tasks 1580→1402ms, 250 895→834ms; first 610ms long-press/overlay/cancel passed Chromium.
- [Native nonanimated TaskItem frame #39105911960](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105911960) 72/72 SUCCESS: Todo synthetic same-runner current→combined near/native medians 25 dense 499→468ms, 250 dense 669→603ms, 1000 dense 1221→951ms, 1000 monthly 684→662ms; offline 1000 dense 1250→983ms. All task rows retained, first long press/cancel passed in 25-task tests. **Synthetic Chrome 2x CPU, not physical device or paint SLA.**
- [Owner-query prewarm #39105689490](https://github.com/carlers/mosaic-life-tracker/actions/runs/39105689490) 84/84 SUCCESS but rejected: gains marginal/inconsistent; prewarm rarely beat normal RxDB emission.
- [Visible-date query #39106414352](https://github.com/carlers/mosaic-life-tracker/actions/runs/39106414352) 84/84 SUCCESS but rejected: at 1000 tasks across five years, Calendar 538→552ms and Todo 723→713ms; omits distant data. Neither data experiment can ship.

## Candidate
- Branch `chatgpt/858-task-row-native-candidate-20261018` cleanly forked from accepted dev, **no synthetic test-only code**.
- `TaskReorderSurfaces.tsx`: remove unregistered inert offscreen drop-target DOM and suppress far-away row layout projection; keep near-row registration and Motion.
- `TaskItem.tsx`: ordinary already-nonanimated rows use a native div instead of Framer Motion; retain all original handlers, classes/geometry, and Motion wrapper for drag overlay/animated modes.
- Browser regression in `tests/e2e/interaction-contract.spec.mjs`: first hold after scrolling to last row, overlay, cancel, full row retention. Existing broader drag/reorder contracts also apply.
- Unrelated test isolation repair `tests/react/AuthProviderPostHog.test.tsx`: reset queued mock implementations per case. Previously deterministic broad-test identity failure then passed after this change.

## Next action
- [Candidate browser gate #39106846020](https://github.com/carlers/mosaic-life-tracker/actions/runs/39106846020): both browser shards SUCCESS; initial focused job failed on AuthProvider/PostHog test.
- [Candidate test repair #39107221351](https://github.com/carlers/mosaic-life-tracker/actions/runs/39107221351): focused Auth test passed but checkpoint exceeded 3,000-token contract; trim fixes this, exact-SHA CI rerun required. Existing browser shards checked separately.
- [Nondeploy production build probe #39107022640](https://github.com/carlers/mosaic-life-tracker/actions/runs/39107022640) SUCCESS: candidate source TypeScript, Vite/PWA and size checks.
- Finish focused CI, repair failures. No stable Preview squash or deployment until authorized; afterward canonical/Scratch READY, real phone/desktop gestures, Diary/photo/shared and account isolation must be accepted. Calendar optimization still open. Security #936/backend #914 remain separate pre-1.0 gates.
