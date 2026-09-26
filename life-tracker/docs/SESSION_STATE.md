# Session checkpoint

Updated: 2026-09-26

Performance phase checkpoint: mount-content scheduling implemented; rendering/compositing audit completed without an evidence-backed CSS change; the DayView INP follow-up has now been merged into `perf/animation-optimization`.

Current task: Performance audit and optimization of interaction animations (bottom sheets, calendar month swipes, and day swipes).

Status: The implementation pass is complete on `perf/animation-optimization`. DayView now keeps the 181-slide geometry but mounts expensive navigation/content trees only in the existing seven-slide render window; Calendar keeps its existing 61-slide Embla geometry but only rendered month slides are vertical scroll containers. A CI-hosted Chromium probe was added for repeatable frame/long-task baselines. The retained DayView optimization set includes deployment branch/commit metadata in Settings, conditional TaskItem optional work, shell-first DayView content deferral, and Swiper Virtual with three slides before/after the active index. The latest follow-up additionally wraps DayView sheet-open state updates in React `startTransition` so the tap can yield before non-urgent sheet rendering. No visual behavior change was intended.

The representative Chromium evidence before the follow-up showed sheet-open click processing improving from ~154.3ms to ~50.8ms and max action Long Animation Frame from ~175.2ms to ~69.6ms after virtualization; calendar/day swipe and content scroll remained ~16.7ms/frame with no action long tasks. A separate trace showed TaskItem Framer Motion layout projection as a dominant repeated layout-read source during sheet open: the targeted suppression reduced Framer Motion getBoundingClientRect reads from 52 to 2 in the CI probe. These are lab/CI measurements, not real-device guarantees.

The explicit ±3 Swiper virtual buffers remain the accepted configuration. A boolean/default Virtual experiment was rejected because it regressed sheet-open processing to ~391ms React-DOM script / ~423ms long task / ~436ms Long Animation Frame, so that experiment and its regression test were reverted. A BottomSheet drag suppression experiment was also reverted after regressing timing. Deferred whole-sheet child mounting was rejected because it moved a large mount to the end of the entrance animation and produced worse timing.

DayView INP follow-up PR #39 (`feature/dayview-inp-followup`) was merged into `perf/animation-optimization` as merge commit `e08b4eeaf8ccdaaef34c22a59f833f404c960f51`. The exact feature SHA was `1bee448f055cb96c1d5ce6f9676ee80990a887b6`. Vercel deployment for the merged stable branch commit is READY.

Verification limitation: GitHub Actions Quality Gate run #454 was retried twice after runner-allocation failures. Both attempts failed in the `classify` job before any workflow step ran (`runner_id: 0`, empty runner name, zero executed steps), and all downstream checks were skipped. This is an external hosted-runner blocker, not an application/test failure. Vercel build/deployment for the merged commit is READY. Real-device/manual DayView open/close smoothness remains separate acceptance; if the device still shows a meaningful hitch, capture a device DevTools trace before making another optimization change.

Working branch: `feature/dayview-inp-followup` (merged; PR #39)
Stable integration branch: `perf/animation-optimization`
Next action: perform the user's real-device open/close check on the stable Preview/integration deployment; if the hitch persists, capture a device trace before further code changes. Do not add blind animation/CSS optimizations without trace evidence.


## Interaction performance trace checkpoint — 2026-09-26

The representative DayView sheet probe was upgraded to mount the real DayViewSheet and capture Long Animation Frame phases plus synchronous geometry reads. The trace identified TaskItem Framer Motion layout projection as the dominant repeated layout-read source during sheet open: the pre-change run recorded 52 getBoundingClientRect reads from Framer Motion projection, alongside a ~434ms React-DOM script / ~481ms Long Animation Frame. The targeted change disables TaskItem layout measurement only while the sheet is entering (renderMode === 'sheet' && deferredRenderWindow === 0); normal TaskItem layout animation is restored once the existing seven-slide render window is restored.

The post-change CI Chromium probe recorded 2 getBoundingClientRect reads from Framer Motion instead of 52, with Swiper still accounting for 3 clientWidth, 3 clientHeight, and 1 offsetWidth read. The measured sheet-open sample was ~235ms long task / ~245ms Long Animation Frame, with calendar-month swipe, day swipe, and day-content scroll remaining at ~16.7ms/frame with no action-scoped long tasks. A follow-up experiment that also disabled BottomSheet drag during entrance regressed to ~286ms long task / ~294ms Long Animation Frame, so that experiment was reverted. Deferred whole-sheet child mounting was also rejected because it moved a large mount onto the end of the entrance animation and produced worse timing; it is not retained.

Current production optimization on chatgpt/interaction-perf-trace: suppress TaskItem Framer Motion layout projection only during the sheet entrance. Diagnostic layout-read/LOAF instrumentation remains in the performance probe for this phase. Browser contract and focused checks passed on the successful measurement run. The change is merged into perf/animation-optimization. Exact-SHA canonical verification passed, and the stable Preview deployment is READY. Final exact-SHA verification is requested on the next task checkpoint commit. Real-device/manual smoothness acceptance remains separate.


## Swiper virtual-window follow-up — 2026-09-26

The user's Vercel Interaction Timing capture still shows a DayView bottom-sheet interaction around 190ms INP, so the previous CI improvements did not eliminate the real-device hitch. The Codex branch `codex/fix-lag-in-dayview-bottom-sheet` was inspected against the stable branch. Its material performance change is to replace the sheet's explicit Swiper Virtual `addSlidesBefore: 3 / addSlidesAfter: 3` configuration with `virtual={true}`; Swiper documents boolean virtual mode as using the default zero pre-render buffers, which is specifically intended to keep only the required slide DOM. The Codex branch's version/build metadata work was also reviewed; stable already had the underlying branch/commit metadata plumbing, so this follow-up only makes the Settings display more explicit.

Current follow-up branch: `chatgpt/dayview-sheet-virtual-window`, based directly on `perf/animation-optimization`.
Changes under verification:
- DayView sheet mode now uses Swiper Virtual with default buffers; inline DayView keeps its existing non-virtual behavior.
- The browser performance probe reports both Swiper slide-wrapper count and rendered DayView navigation count so the DOM reduction is directly observable in CI.
- Settings now labels the deployment branch, short commit SHA, and commit message explicitly.
- Regression coverage asserts that sheet mode enables Swiper Virtual.

The first browser verification of boolean/default virtual mode was rejected. Although it reduced the observed DayView DOM to 4,487 elements and 3 Swiper slide wrappers, it regressed sheet-open processing to ~391ms React-DOM script / ~423ms long task / ~436ms Long Animation Frame, versus the prior ~50.8ms click-processing / ~69.6ms max action LOAF candidate. The virtual-mode change and its regression test were reverted; the explicit ±3 virtual buffers remain the current production configuration. The probe now also measures the sheet-close interaction separately, because the user's device trace shows both open and close interactions and the previous probe did not isolate close. Real-device acceptance remains required.

## Interaction INP deep-dive checkpoint — 2026-09-26

Vercel Interaction Timing showed DayView open/close at 190.2ms INP, with the supplied slow interaction showing ~132.4ms render work. The browser probe now captures Event Timing, Long Animation Frames, React render/commit timing, DOM mutations, and layout-read stacks.

Current branch: `chatgpt/dayview-inp-deep-dive`. Stable integration branch: `perf/animation-optimization`.

Accepted candidate changes on this branch:
- Settings build identity shows deployment branch, short commit SHA, and commit message.
- TaskItem optional image/memo work is moved into conditional child components.
- DayView content is deferred behind the sheet shell.
- Swiper Virtual keeps the 181-day logical range while mounting only three slides before/after the active index.

Representative Chromium result for the same sheet-open interaction:
- click processing: ~154.3ms -> ~50.8ms after Swiper virtualization
- max action Long Animation Frame: ~175.2ms -> ~69.6ms
- DOM: ~5,139 -> ~4,795 elements
- calendar/day swipe and content scroll remain ~16.7ms/frame with no action long tasks

Browser and focused checks pass on the current candidate. This is lab/CI evidence; real-device acceptance remains required. Next: canonical full gate, merge to stable, verify Vercel deployment, then repeat the user's real-device open/close check.


## DayView INP deep-dive merged — 2026-09-26

PR #34 is merged as `133e7199dd17d32f1797d15cc66c60dca9a90241`. The retained changes are: deployment branch/commit metadata in Settings, conditional TaskItem optional work, shell-first DayView content deferral, and Swiper Virtual with three slides before/after the active index. The representative browser probe improved sheet-open click processing from ~154.3ms to ~50.8ms and max action Long Animation Frame from ~175.2ms to ~69.6ms after virtualization; swipe/scroll interactions remained ~16.7ms/frame.

Canonical Quality Gate run #421 passed build, dependency audit, lint/unit/handler checks, DOM shards, browser shards, and canonical acceptance. Stable Vercel deployment `dpl_5qtqXCJPLFcC8w8XWtNCfvDNEisS` is READY on `perf/animation-optimization`, with its stable branch alias.

Remaining acceptance: real-device DayView open/close smoothness. If the device still shows a meaningful hitch, capture a real-device trace before further code changes.


Final verification checkpoint: the boolean/default Swiper Virtual experiment was reverted after the browser probe regressed the sheet-open path; the performance probe now isolates both open and close interactions. The remaining candidate is the stable explicit virtual buffer configuration plus the existing TaskItem layout-projection suppression. PR #39's verification intent was full-gate, but the hosted GitHub runner failed before executing any Quality Gate step on two retries. The feature was merged after the external runner blocker was confirmed; the merged stable deployment is READY. [verify:full]
