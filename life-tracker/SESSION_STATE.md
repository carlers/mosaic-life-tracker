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
2. **In progress — profile DOM and browser execution to locate the real hot spots and safe parallelism opportunities.**
3. **Pending — add/adjust regression contracts for runner configuration where needed.**
4. **Pending — implement the smallest safe runtime optimizations and run focused measurements.**
5. **Pending — run exact final `[verify:full]`, compare shard/full wall times to baseline, repair any failures.**
6. **Pending — fast-forward Preview to the exact canonical-green SHA and verify deployment/Preview guard.**

Roadmap pointer: developer workflow / CI latency.
Blockers: none.
