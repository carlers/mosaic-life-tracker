# Session state

Updated: 2026-09-24
Current task: CI workflow optimization + automatic Preview advancement
Status: implementation and intermediate workflow validation complete; exact final commit is entering canonical acceptance.

## Active user prompt

> ok go do it

## Approved scope

- Preserve exact-final-SHA full acceptance before deployment.
- Keep the existing shallow diff checkout and same-ref concurrency cancellation.
- Add a lightweight docs-only verification path rather than running full test/build/browser CI for ordinary documentation-only changes.
- Parallelize the canonical full gate into independent static checks/lint, unit tests, handler tests, DOM tests, production build/PWA/size guard, and browser contracts.
- Retain reproducible final dependency verification with fresh `npm ci`; keep existing npm/browser caches and only add extra cache layers when they have a clear payoff.
- Avoid re-running the same canonical gate solely because an already full-green SHA is advanced to `preview`.
- After every completed task, automatically fast-forward `preview` to the exact full-green task SHA and verify deployment.
- Update repository workflow/process documentation to make this the new default.

## Progress

1. **Done — recover governing rules and current workflow.** Read AGENTS.md, SESSION_STATE.md, PLAN.md, REMOTE_VERIFY.md, TEST_WORKFLOW.md, PREVIEW_DEPLOYMENT.md, package scripts, focused verifier, Vitest project config, and `.github/workflows/verify.yml`.
2. **Done — workflow diagnosis/alignment.** Confirmed main Verify already uses `fetch-depth: 2`, same-ref `cancel-in-progress: true`, npm caching, focused `node_modules` caching, prepared browser dependency caching, and Chromium caching. Main remaining latency is the serial full repository gate plus duplicate Preview verification.
3. **Done — establish the previous Home-search SHA as Preview baseline.** `preview` was fast-forwarded from `aad2355…` to the already full-green Home-search commit `551b706e6fdcb9a06c3489e5fa8dfd02e9efa46e`.
4. **Done — implement CI optimization + focused validation.** Verify #274 (`35970512577`) used the new workflow on implementation commit `864b291137b381ca747edbb2678f555c5510af0a`: classifier chose focused mode, all unrelated full/Preview jobs skipped, project contracts and 96-file discovery passed, and the changed-test run passed 1/1 file with 6/6 CI-classifier tests. Focused verification covered 8 changed files.
5. **Done — validate the live docs-only path.** Verify #275 (`35970646318`) classified the state-only checkpoint as docs mode; `docs-checks` passed while focused/full/browser/Preview jobs were skipped. No application dependency install, Vitest, production build, or browser contract ran.
6. **In progress — run canonical full parallel acceptance.** This exact final commit removes the deprecated cache `save-always` inputs, keeps the successful cache behavior, and carries the final task checkpoint before `[verify:full]` acceptance.
7. **Pending — fast-forward Preview to that exact green SHA and verify its prior-acceptance guard plus Vercel deployment.**
8. **Pending — report measured/structural CI improvements.**

## Test evidence review

- `CI-MODE-CLASSIFICATION` — **skipped red-state capture; current direct automated coverage**: `tests/unit/ciClassify.test.ts` pins docs-only, focused, explicit full, pull-request, Preview-guard, and explicit browser classification. Focused Verify #274 passed 6/6 classifier tests; no pre-implementation red was captured because the classifier and its first tests landed in the same implementation commit.
- `CI-FOCUSED-PATH` — **operational workflow evidence**: Verify #274 selected `focused-checks` for the implementation push and skipped every unrelated canonical/Preview job.
- `CI-DOCS-PATH` — **operational workflow evidence**: Verify #275 selected only `docs-checks` for a documentation-only push and passed project-contract + diff checks without dependency/test/build/browser work.
- `CI-FULL-PARALLEL` — **pending acceptance** on this exact `[verify:full]` commit; expected required checks are static/lint, unit, handlers, DOM, build/PWA/size, browser, then `canonical-acceptance`.
- `CI-PREVIEW-GUARD` — **pending deployment evidence** after full-green acceptance; Preview must run only classifier + `preview-verified` and reuse the prior exact-SHA `canonical-acceptance` result.
- No user-visible app behavior changed; real-device manual acceptance is not applicable to this workflow-only task.

Roadmap pointer: developer workflow / CI latency.
Blockers: none.
