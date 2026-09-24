# Session state

Updated: 2026-09-24
Current task: Minimize canonical CI runner/dependency startup time
Status: startup optimization implemented; focused green/full benchmark pending.

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
3. **Done — capture startup regression red.** Focused Verify #291 (`35975502098`) failed exactly the three new startup assertions: immediate full intent still required classifier checkout, DOM/build lacked the app dependency restore, and cache-hit parallel jobs still restored the npm download cache. The other workflow tests remained green.
4. **In progress — implement and validate startup optimization.** Immediate Preview/manual/full intent now bypasses classifier checkout; focused/DOM/build/browser cache-hit paths restore only lockfile-keyed `node_modules`, with DOM/build install fallback. `checks` remains the single mandatory fresh `npm ci` reproducibility gate.
5. **Pending — exact final `[verify:full]` benchmark versus #288 and canonical acceptance.**
6. **Pending — fast-forward Preview to the exact green SHA and verify Preview guard + Vercel deployment.**

Roadmap pointer: developer workflow / CI latency.
Blockers: none.


## Test evidence review

- `CI-IMMEDIATE-CLASSIFY` — **added-red-green pending green run**: #291 failed because the classifier had no pre-checkout immediate-intent step; implementation now resolves Preview/manual/`[verify:full]` intent before repository checkout.
- `CI-SHARED-APP-CACHE` — **added-red-green pending green run**: #291 failed because DOM/build still ran unconditional fresh installs; implementation restores the existing lockfile-keyed focused app cache with `npm ci` fallback.
- `CI-CACHE-HIT-SETUP` — **added-red-green pending green run**: #291 failed because cache-hit DOM/build/browser paths still requested setup-node's npm download cache; implementation removes that redundant restore while keeping Node 22 setup.
- `CI-FRESH-INSTALL-PROOF` — **existing-direct**: the combined `checks` job still performs a fresh `npm ci --prefer-offline --no-audit` on every canonical full run.
- No application behavior changes; manual device/browser acceptance is not applicable to this CI-only task.
