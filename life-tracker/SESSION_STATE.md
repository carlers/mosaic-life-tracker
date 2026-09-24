# Session state

Updated: 2026-09-24
Current task: Minimize canonical CI runner/dependency startup time
Status: regression-test typo repaired; final exact-SHA canonical benchmark in progress.

## Active user prompt

> are we good now

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
4. **Done — implement and validate startup optimization.** #292 (`35975831772`) was rejected before job creation because the generated workflow edit accidentally duplicated a YAML block; this was an unrelated configuration-generation error, not test evidence. Repaired Verify #293 passed every required shard plus `canonical-acceptance`. Its immediate classifier completed in ~3s with checkout skipped. Because this new branch had no successful prior dependency/browser cache, DOM/build/browser exercised the safe cold fallback and populated branch caches.
5. **Done — first warm-cache benchmark.** Verify #296 (`35976355637`) passed every shard plus `canonical-acceptance`. Active canonical time from classifier start to acceptance completion was ~74s versus ~79s for #288. Immediate classification fell from ~7s to ~3s; warm DOM/browser dependency installs were skipped. The combined `checks` job became the critical path because it still serialized the one fresh install before lint/unit/handlers.
6. **Done — final critical-path topology validated.** Verify #298 proved the runtime topology: build, both DOM shards, and both browser shards passed; checks used the warm dependency cache while build alone performed the fresh `npm ci`. Its only failure was the regression-test coding typo (`checksJob is not defined`), now repaired in the final task tip.
7. **In progress — final exact-SHA canonical benchmark.** Run the complete gate on this repaired tip, then fast-forward Preview only after `canonical-acceptance` is green and verify Vercel.


Roadmap pointer: developer workflow / CI latency.
Blockers: none.


## Test evidence review

- `CI-IMMEDIATE-CLASSIFY` — **added-red-green**: #291 failed because the classifier had no pre-checkout immediate-intent step; #293 passed with immediate intent resolving in the classifier job while checkout/classifier-script steps were skipped.
- `CI-SHARED-APP-CACHE` — **added-red-green**: #291 failed because DOM/build still ran unconditional fresh installs; #293 passed the cold path with cache restore attempts plus successful `npm ci` fallback, populating the branch cache for the final warm benchmark.
- `CI-CACHE-HIT-SETUP` — **added-red-green**: #291 failed because DOM/build/browser paths still requested setup-node's npm download cache; #293 passed with Node 22 setup no longer restoring that redundant cache.
- `CI-FRESH-INSTALL-PROOF` — **existing-direct, ownership moved**: every canonical full run still performs one fresh `npm ci --prefer-offline --no-audit`; the final pass moves that proof from `checks` to the parallel production `build` job so checks can use the warm dependency tree.
- No application behavior changes; manual device/browser acceptance is not applicable to this CI-only task.
