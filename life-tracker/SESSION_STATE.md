# Session state

Updated: 2026-09-24
Current task: Minimize canonical CI runner/dependency startup time
Status: profiling and implementation in progress on `chatgpt/optimize-ci-startup`.

## Active user prompt

> can we minimize that ordinary runner/dependency startup time even further

## Approved scope

- Reduce canonical CI startup overhead without weakening exact-final-SHA acceptance.
- Preserve at least one fresh lockfile-driven `npm ci` in every full acceptance run.
- Reuse the existing lockfile-keyed app dependency cache for parallel jobs that do not need to independently prove install reproducibility.
- Remove avoidable serial startup barriers for explicit `[verify:full]` commits.
- Keep docs-only/focused classification behavior, DOM/browser sharding, canonical aggregation, automatic Preview advancement, and deployment guard intact.
- Benchmark against final Verify #288 before closing.

## Progress

1. **Done — recover current Preview and workflow rules.** Read AGENTS.md, SESSION_STATE.md, PLAN.md, REMOTE_VERIFY.md, TEST_WORKFLOW.md, PREVIEW_DEPLOYMENT.md, Verify workflow, and package scripts.
2. **Done — identify startup hot spots from final green Verify #288.** The classifier gates canonical runners for ~7–12s. Both DOM shards independently spent ~11–17s on `npm ci`; build spent ~10s. Browser already restores the focused app-dependency cache.
3. **In progress — pin and implement two optimizations:** allow explicit full-gate jobs to launch without waiting for classifier, and restore the same lockfile-keyed app dependency cache in DOM/build with `npm ci` fallback while `checks` retains the mandatory fresh install.
4. **Pending — focused regression validation and repair.**
5. **Pending — exact final `[verify:full]` benchmark versus #288 and canonical acceptance.**
6. **Pending — fast-forward Preview to the exact green SHA and verify Preview guard + Vercel deployment.**

Roadmap pointer: developer workflow / CI latency.
Blockers: none.
