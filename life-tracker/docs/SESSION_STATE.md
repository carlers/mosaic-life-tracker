# Session checkpoint

Updated: 2026-09-26

Current task: isolate and optimize the remaining real-device DayView bottom-sheet close hitch on `chatgpt/dayview-close-smoothness`.

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
- Reverted to the stable teardown path: close measured about 337ms LOAF with the same 52 reads.
- Disabled TaskItem layout projection for the entire sheet lifecycle: layout reads fell from 52 to 2, but close still measured about 342ms LOAF, so projection was not the whole cost.
- Combined projection suppression + deferred-child retention: close measured about 332ms LOAF with 2 reads. This was only a small improvement.
- Current experiment: add `will-change: transform` only to the fixed BottomSheet surface. Motion's current guidance identifies transform/opacity as the compositor-safe animation path and documents `will-change: transform` as a targeted layer-promotion hint. Browser verification is required before accepting or reverting it.
- Focused regression coverage pins sheet-mode TaskItem layout suppression and the deferred-child exit contract.
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
- Run browser verification for the current layer-promotion experiment and inspect `bottom-sheet-close`.
- If the trace improves materially, run the canonical full gate, publish the stable Preview, and perform real-device open/close acceptance.
- If it does not, revert the hint and continue from the trace's render/style evidence; do not add blind animation/CSS changes.
Constraints:
- Do not claim real-device acceptance without an actual device check.
- Do not replace the accepted explicit Swiper virtual buffers without new evidence.
- Preserve BottomSheet history/Back-stack behavior and existing visual behavior.
- Use a coherent `chatgpt/**` task branch and include `[verify:full]` on the final acceptance commit.
- Vercel Preview is only considered delivered after the exact final SHA receives canonical acceptance.

Verification:
- Quality Gate runner allocation now assigns real hosted runners (current successful jobs show named `ubuntu-latest` runners).
- Latest run before the state-file condensation: build, dependency audit, both DOM shards, both browser shards, and classify passed; checks failed only on the handoff token-budget assertion.
- Manual/device close smoothness remains unverified.
- Vercel deployment for the stable `perf/animation-optimization` branch was previously READY; the new task branch is intentionally not a deployable stable branch.

Next action: push the layout-projection candidate with `[verify:browser]` and inspect `bottom-sheet-close`. If the 52 layout reads disappear and the close LOAF drops materially, promote the same code to a final `[verify:full]` commit.

Blockers: none currently. The previous hosted-runner allocation blocker is no longer reproducing; the remaining blocker to completion is verification of the close-path performance candidate and real-device acceptance.
