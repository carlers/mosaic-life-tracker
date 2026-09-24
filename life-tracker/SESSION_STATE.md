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
5. **In progress — exact final `[verify:full]` benchmark/acceptance.** Compare both DOM shard times, Playwright duration, and overall gate wall time against Verify #281; repair any isolation/flakiness or imbalance before Preview moves.
6. **Pending — fast-forward Preview to the exact canonical-green SHA and verify deployment/Preview guard.**

Roadmap pointer: developer workflow / CI latency.
Blockers: none.
