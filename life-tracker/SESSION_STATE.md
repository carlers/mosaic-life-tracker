# Session state

Updated: 2026-09-24
Current task: Optimize DOM tests and browser contracts for CI runtime
Status: profiling and optimization in progress on `chatgpt/optimize-dom-browser-ci`.

## Active user prompt

> dom tests and browser contract are still the slowest ones, can u optimize them further for run time

## Approved scope

- Reduce canonical CI wall time by optimizing the DOM Vitest shard and Playwright browser-contract shard.
- Preserve test coverage/behavioral assertions; do not remove meaningful coverage just to make CI faster.
- Prefer evidence-driven runner/config/test-harness changes over broad product refactors.
- Keep exact-final-SHA canonical acceptance and automatic Preview advancement unchanged.
- Benchmark/compare against the current successful full-gate baseline before closing the task.

## Progress

1. **Done — recover current Preview baseline and governing workflow rules.** Read AGENTS.md, SESSION_STATE.md, PLAN.md, REMOTE_VERIFY.md, TEST_WORKFLOW.md, PREVIEW_DEPLOYMENT.md, Verify workflow, Vitest project config, and package scripts.
2. **Done — profile DOM and browser execution.** Baseline final Verify #281 showed the DOM project at 54 files / 209 tests / 50.98s Vitest duration; the heaviest files included `DayViewSheetRegression` (~9.6s) and `TodoListView` (~5.4s). Playwright ran 27 tests on one worker in 57.7s. All browser specs use isolated Playwright pages/contexts and no shared mutable backend fixture.
3. **Done — capture regression red.** Focused Verify #284 (`35973206325`) failed only the two new workflow-performance assertions: DOM lacked a matrix `strategy`, and `playwright.config.mjs` was absent. The other 7 workflow-contract assertions remained green.
4. **Done — implement bounded parallelism.** Canonical DOM is split across two Vitest file shards; Playwright uses `fullyParallel: true` with two CI workers. Two workers matches Playwright's documented two-core GitHub Actions medium runner guidance; local runs keep the default worker count. No application/runtime code or test assertions were removed.
5. **Done — benchmark the distributed topology and isolate one assertion-only repair.** Verify #285 passed canonical acceptance but showed same-run Playwright worker parallelism was ineffective (~57.3s vs ~57.7s baseline) and cold prepared browser dependencies cost 63s. Verify #286 then provisioned all six canonical runners immediately: DOM shards passed with ~38s/~33s test steps; browser shards passed with ~37s/~33s test steps; isolated Playwright/Axe install took ~3s instead of the prior 63s prepared-dependency step. Its only failure was the new workflow-contract parser matching top-level `permissions.checks` instead of the `jobs.checks` block; product/runtime tests did not fail.
6. **In progress — final exact-SHA canonical acceptance.** Verify #287 confirmed all DOM/build/browser performance jobs green but the unit workflow-contract assertion still matched top-level `permissions.checks` because the split did not require a newline after the job key. The final assertion now anchors on `\n  checks:\n`; rerun the complete gate, then fast-forward Preview only if `canonical-acceptance` is green.
7. **Pending — fast-forward Preview and verify the prior-acceptance guard plus Vercel deployment.**

Roadmap pointer: developer workflow / CI latency.
Blockers: none.


## Test evidence review

- `DOM-CI-SHARDING` — **added-red-green**: Verify #284 failed the new assertion because the DOM job had no matrix strategy. Verify #285/#286 executed both `1/2` and `2/2` shards successfully; #286 test steps were about 38s and 33s versus the 50.98s single-project baseline.
- `BROWSER-CI-DISTRIBUTION` — **added-red-green**: Verify #284 structurally failed because `playwright.config.mjs` did not exist. Verify #285 ran 27/27 browser tests with two same-runner workers but showed no material runtime gain, so the topology was revised to two one-worker CI shards; #286 browser test steps passed in about 37s and 33s.
- `BROWSER-COLD-SETUP` — **operational benchmark evidence**: #285's sibling-branch prepared dependency cache miss spent 63s preparing browser dependencies plus 10s installing Chromium. #286 isolated Playwright/Axe packages under `tests/e2e`; that install took about 3s, while root app dependencies use the focused-task cache when available.
- `CANONICAL-RUNNER-BUDGET` — **added regression coverage / operational evidence**: six canonical runner slots now contain combined checks, build, two DOM shards, and two browser shards. #286 provisioned all six immediately; its only failure was the test's ambiguous string split, now repaired.
- No application behavior changed; manual browser/device acceptance is not applicable to this CI-only task.
