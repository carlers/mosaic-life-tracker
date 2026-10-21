# Session checkpoint
Updated: 2026-10-21 UTC
Current task: issue #404 — v0.40.4 split-panel open/close, month snap, divider and full-height correction.

## Exact branches and boundary
- Task `chatgpt/404-resize-root-cause-20261021`, draft PR #1184; upstream stable Preview `feature/split-day-panel-dev-404-20261021@08c7a003af04121c50de60b7bdd37eef73efd782` remains v0.40.3 and is NOT this candidate.
- `dev` baseline for #404 remains `e1c90b387ecfb4e29d64c88b6557703dd23ca207`. No approval to merge `dev`, `main` or Production.

## Root cause and changes
- Native horizontal scroll in the Embla viewport was independent from Embla's track transform. When the panel opened on the left, browser focus/scroll adjustment intermittently left `scrollLeft=8`, shifting the month grid 8 CSS px even while Embla's logical selected index and transform were correct. Real Chromium geometry verified the offset and its elimination by changing only the outer CalendarCarousel clipping container from `overflow-hidden` to `overflow-clip`, so it is not a native scroll container. Nested month-grid zoom/vertical scroll containers remain separate.
- Previous v0.40.4 candidate suppresses competing Embla auto-reinit during panel motion, pins the focused month transform with viewport-relative CSS, performs one settled reinit, removes transition easing while dragging, coalesces pointer width updates, and measures both side-panel height modes down to the Home workspace bottom.
- Test-only split fixture now explicitly fixes both 750px workspace and 470px calendar heights with inline styles. Prior test-only Tailwind classes were not emitted, so its first browser assertion was invalid; the current fixture actually exercises a short calendar.
- Strong browser test navigates to next month before opening, samples per-paint focused-month offset and full slide width during open/drag/close for left/right and grid/screen, asserts under 2px alignment, and requires zero native horizontal viewport scroll.
- Version remains 0.40.4. No security/size budget, feature flags, backend, authentication or release gate changes.

## Verification performed (isolated Vercel sandbox)
- Exact earlier task source at `8ac9513975cb727fcb9913a5075bc03320b4b8a7`, plus the three scoped local file changes described above; independent `npm ci`.
- Production PWA build and strict size budget PASS with patched source: Home static closure **380,892 / 381,000 gzip bytes**, initial 149,180 / 154,500. `npm run version:check` and `git diff --check` PASS.
- Chromium real-browser split tests PASS **12/12 repeated cases** (3 repetitions per left/right and grid/screen). Open, live divider, close, offset, full slide width, panel bottom and native viewport scroll all asserted.
- Full local Playwright browser suite **77/79 PASS**. Both failures were outside split tests: PostHog instrumentation not configured at initial sandbox start, and offline-startup's transient indicator timed out while its recorded browser snapshot already showed locally rendered Calendar. After configuring the CI PostHog environment, PostHog PASS; offline transient assertion still fails in this sandbox. Do not claim canonical browser shard success.
- `npm run lint` PASS (0 errors; 19 existing warnings); `npm run test:unit` PASS **1,204/1,204**; `npm run test:dom` PASS **655/655**.

## CI and next action
- Initial source task commit `c75d2a4` [full Quality Gate 39607228490](https://github.com/carlers/mosaic-life-tracker/actions/runs/39607228490) FAILED blocking Home size by 23 B, plus an invalid short-grid fixture prerequisite. Both addressed; the sandbox patched source passes budget and stricter real-browser split assertions.
- User dispatched [full GitHub Quality Gate 39624509477](https://github.com/carlers/mosaic-life-tracker/actions/runs/39624509477) at task SHA `ff07dd8789897180f417b3bd24f71bcdb3bd6456`. Static checks, audit, two DOM shards, two browser shards PASS; build FAIL blocking Home gzip 381,016/381,000 (+16 B); canonical FAIL as required.
- A focused React state simplification on top of `ff07dd8` removes redundant same-value setter lambdas and two 0/1 aliases in Home/Calendar. Existing calendar behavior and API untouched. Local sandbox exact public Preview config: Home gzip 380,889/381,000 PASS; lint PASS; 1,204 unit/655 DOM PASS. GitHub's additional secret Preview vars mean an exact-SHA GitHub production build check is still required; no CI pass asserted.
- GitHub connector Git-object/Contents API writes did not emit Actions runs; PR #1184 metadata remained at `c75d2a4` despite branch advancing. Need authenticated manual workflow dispatch for new task SHA after this final commit; do not claim CI passed or squash to stable Preview until it does.
- Resolve GitHub push/Actions trigger and PR head synchronization through an authorized authenticated Git push or explicit workflow dispatch at this task SHA. Inspect canonical CI (including the offline/telemetry contracts) and trusted Vercel Preview READY at the exact eventual stable SHA. Manual authenticated large-screen/owner-friend, nested modal and device acceptance remains outstanding.
- Never merge Preview to dev/main or mutate Production without explicit approval.
