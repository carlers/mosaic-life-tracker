# Session checkpoint

Updated: 2026-09-26

Current task: calendar row minimum height in `chatgpt/calendar-row-min-height`.

Status: CI runner allocation is operational again on the public repository. PR #41 (`ci: reduce duplicate Quality Gate runner demand`) was merged into `perf/animation-optimization` as `2e033313a51171f5305e53cac4b995b1af609b67`. The Quality Gate is push-driven only, so PRs receive checks from their pushed head SHA without a duplicate pull_request run. The repository was made public by the user after hosted-runner execution recovered; this is operational evidence, not proof of an internal GitHub throttle/quota cause.

The interaction-performance phase already retained:
- Settings deployment branch/short SHA/commit message metadata.
- Conditional TaskItem optional work.
- Shell-first DayView content deferral.
- Swiper Virtual with explicit `addSlidesBefore: 3` / `addSlidesAfter: 3`.
- TaskItem Framer Motion layout-projection suppression during sheet entrance.
- CI Chromium instrumentation for Event Timing, Long Animation Frames, React render/commit timing, mutations, and synchronous layout reads.

Representative lab evidence: sheet-open click processing improved from about 154ms to 51ms and max action Long Animation Frame from about 175ms to 70ms after the accepted virtualization changes. A separate trace reduced Framer Motion `getBoundingClientRect` reads from 52 to 2 during sheet entrance. These are CI/lab measurements, not device guarantees. A boolean/default Swiper Virtual experiment and BottomSheet drag-suppression experiment were both reverted after measurable regressions.

Close-path evidence so far:
- Rejected deferred-child exit retention by itself: close measured about 335ms LOAF with 52 Framer Motion layout reads.
- Disabled TaskItem layout projection for the sheet lifecycle: layout reads fell from 52 to 2, but close stayed around 342ms LOAF, so projection was not the whole cost.
- A direct-transform sheet rewrite reduced the probe substantially but broke sheet drag interaction; the exit-only variant preserved drag without a material improvement.
- Native CSS transition was rejected because browser contracts did not observe transition-end cleanup and the close probe stayed around 325ms.
- Shadow/overflow paint experiments were noisy and did not explain the remaining cost.
- The stable candidate is contain: paint on the fixed sheet surface. With the same 0.32s Framer exit duration, the tap-driven close probe fell from roughly 325ms action duration / 315ms LOAF to roughly 192ms / 184ms, across repeated browser runs. Layout reads remain at 2. The improvement is therefore tied to paint containment rather than shortening the animation.
- The performance probe now closes by tapping the documented exposed backdrop strip, matching the real phone dismissal contract rather than measuring Escape.
- Focused regression coverage pins deferred-child exit retention and BottomSheet dialog semantics.
Working set:
- `life-tracker/src/components/ui/BottomSheet.tsx`
- `life-tracker/tests/components/BottomSheet.test.tsx`
- `life-tracker/docs/SESSION_STATE.md`

Completed substeps:
- Merged PR #41 CI runner-demand mitigation.
- Created `chatgpt/dayview-close-smoothness` from the merged stable commit.
- Identified the exit-teardown candidate.
- Added the exit-teardown regression test.
- Investigated and repaired two React lint failures exposed by CI.

Remaining substeps:
- Run the canonical full gate on the final task SHA.
- After exact-SHA canonical acceptance, publish the stable Preview branch and perform the required real-device open/close acceptance.
- If device evidence shows remaining hitching, continue from a device trace; do not revert the paint-containment candidate without evidence.
Constraints:
- Do not claim real-device acceptance without an actual device check.
- Do not replace the accepted explicit Swiper virtual buffers without new evidence.
- Preserve BottomSheet history/Back-stack behavior and existing visual behavior.
- Use a coherent `chatgpt/**` task branch and include `[verify:full]` on the final acceptance commit.
- Vercel Preview is only considered delivered after the exact final SHA receives canonical acceptance.

Verification:
- Focused Quality Gate passed on the implementation.
- Browser contracts passed with contain: paint; the tap-driven close probe measured about 192ms action duration and 184ms max Long Animation Frame on the latest repeated run, with 2 layout reads.
- The canonical full gate passed on the code checkpoint immediately before this documentation-only finalization; the exact final SHA below still needs its own canonical acceptance.
- Real-device close smoothness remains unverified.
- Vercel Preview remains pending exact-SHA canonical acceptance.
Next action: wait for this final [verify:full] documentation checkpoint to receive canonical acceptance, then create the stable feature Preview branch from the accepted SHA and perform the real-device close protocol.

Blockers: none currently. The previous hosted-runner allocation blocker is no longer reproducing; the remaining blocker to completion is verification of the close-path performance candidate and real-device acceptance.

## Close animation cohesion follow-up — 2026-09-26

The first paint-containment fix exposed a visual synchronization issue: the fixed sheet container remained stationary while a nested motion wrapper translated its contents, making the background/shadow appear detached from the content. The fix moves the same 0.32s transform animation onto the draggable fixed dialog surface itself, so the container, shadow, clipping, header, and content share one compositor transform. The nested motion wrapper was removed; drag and history behavior remain on the animated surface.

Verification is running on the feature branch. Real-device visual acceptance remains required.

## Stable Preview handoff — 2026-09-26

The accepted task SHA `bc78a220c87ff6c086ab51236bc442e2e79a0cbf` was copied to `feature/dayview-close-paint-containment` for the configured Vercel Preview delivery path. This branch adds no runtime changes; its own canonical gate is required before treating the feature Preview as delivered.

## Wide content width follow-up — 2026-09-26

Added a third large-screen Content width option, Wide, alongside Full screen and Comfortable. Wide centers the shared primary route-swipe surface at 85vw from the tablet breakpoint upward; phone layouts remain full width. Added settings, layout, and regression coverage.

Verification: focused unit/component checks are required on the final task SHA. Preview delivery follows the existing chatgpt task branch → feature/ui-improvements squash-merge flow.

## Todo month grid centering follow-up — 2026-09-26

The fixed-column centering attempt was reverted after visual review showed the visible grid was still offset. The current correction targets the parent surface instead: the Todo calendar is made full-bleed across the Todo view's horizontal padding, while the month grid returns to the existing flexible seven-column layout and centers within that full content surface. This removes the padded scroll region as a separate horizontal reference frame. Regression coverage verifies the restored grid geometry and centered day cells.


## Todo DayView large-jump fix — 2026-09-26

Removed Swiper Virtual from DayView. Swiper now owns all 181 lightweight geometry slides, while React keeps the existing seven-slide expensive-content render window. This removes the competing Swiper/React virtualization state that left direct jumps (for example Sep 11 → Sep 30) visually stale until a one-day swipe reconciled Swiper.

Verification: focused regression coverage updated for direct large jumps. Final commit requires canonical full acceptance before Preview delivery.

## Calendar row sizing — 2026-09-26

MonthView/WeekView use real seven-column week rows with max-content sizing, so each row follows its own tallest cell. DayCell now reserves 4.25rem, equivalent to a day label plus two standard text-only task blocks, while taller content can still expand the row.

