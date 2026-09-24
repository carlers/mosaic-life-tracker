# Session state

Updated: 2026-09-24
Current task: CI workflow optimization + automatic Preview advancement
Status: implementation authorized on `chatgpt/ci-workflow-optimization`.

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
5. **In progress — validate the live docs-only path.** This documentation-only checkpoint should run only classifier + `docs-checks`, with no dependency install, Vitest, build, or browser job.
6. **Pending — run the canonical full parallel acceptance gate on the exact final task SHA.**
7. **Pending — fast-forward Preview to that exact green SHA and verify its prior-acceptance guard plus Vercel deployment.**
8. **Pending — report measured/structural CI improvements.**

Roadmap pointer: developer workflow / CI latency.
Blockers: none.
