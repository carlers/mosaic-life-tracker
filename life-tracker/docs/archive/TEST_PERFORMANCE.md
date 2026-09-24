# Test performance history through 2026-09-24

Dated evidence, not current suite counts.

### 2026-09-20 baseline and first optimization

The pre-change environment reported 43 discovered files / 416 tests and approximately:

| Scope | Vitest duration | Wall time |
|---|---:|---:|
| Unit | 11.91s | 16.10s |
| Handlers | 4.69s | 8.89s |
| React | 16.48s | 20.63s |
| Components | 27.57s | 31.75s |
| Full | 58.94s | 63.24s |

The audit found `tests/hooks/useFocusTrap.test.tsx` outside every project. React,
component, and hook tests now share one `dom` project, and the suite caps workers at four
to avoid oversubscription on hosts that report large CPU availability. In this two-CPU
container, three first-batch full runs discovered 44 files / 422 tests with a 43.81s
median wall time (individual runs: 44.20s, 43.81s, and 42.72s). A representative four-worker DOM run completed in 30.68s
Vitest / 32.86s wall time. Treat these as environment-specific reference points, not hard
CI budgets; use the benchmark command for future decisions.


### 2026-09-20 follow-up

Expected outbox/social logs are now suppressed only inside the suites that exercise those
paths, while unrelated console output still passes through. RxDB-backed hook/provider tests
still create and remove a database per test for isolation, but register only the `messages`
or `friendships` collection they use. The message bubble also uses valid, keyboard-operable
non-nested controls, removing the prior React warning.

Three follow-up full runs covered 423 tests and measured 44.02s, 43.21s, and 43.00s wall
time (43.21s median). The small timing gain is secondary to quieter output, complete
coverage, and preserving per-test database isolation.


### 2026-09-24 canonical DOM/browser parallelism

The canonical remote gate keeps the same DOM and browser assertions while reducing their
critical-path wall time in two ways:

- The `dom` Vitest project is split into two GitHub Actions shards with
  `--shard=1/2` and `--shard=2/2`. Both matrix jobs must pass before
  `canonical-acceptance` can succeed. Vitest sharding partitions test files; it does not
  skip tests from the combined canonical run.
- Playwright uses `fullyParallel: true` plus two GitHub Actions shards. Each shard uses
  one Playwright worker, so browser parallelism comes from separate runners rather than
  contending Chromium instances on the same two-core machine. The browser job restores the
  task branch's focused app dependency cache when available and keeps the small pinned
  Playwright/Axe dependency tree in `tests/e2e/node_modules`.
- The formerly separate static/lint, unit, and handler jobs are one `checks` job. Their
  combined runtime remains below the previous critical path while freeing runner capacity
  so both DOM and browser shard pairs can start without starving one another.
- Canonical startup keeps one fresh `npm ci` in `build` for lockfile reproducibility. Checks,
  DOM, browser, and focused jobs restore the immutable lockfile-keyed app dependency tree
  with an install fallback, and skip the separate npm download-cache restore on normal hits.
  Explicit full/Preview intent is also resolved before classifier checkout.
- GitHub caches are branch-scoped. A task branch with no earlier successful focused/full run
  uses the install fallback once; that successful run seeds the branch cache. Normal later
  full acceptance on the same task branch uses the warm immutable dependency/browser caches.

For a local browser-contract run, prepare the isolated browser packages once with
`npm run test:browser:prepare`, then run `npm run test:browser-contract`.

Keep these as bounded concurrency settings. If the hosted runner class or suite shape
changes materially, benchmark before increasing shard/worker counts.

### 2026-09-24 assertion-preserving consolidation

The suite now has 93 Vitest files / 594 cases (335 unit, 55 handler, 204 DOM),
including three new focused-verifier path regressions, and 23 browser contracts.
Six DOM modules were eliminated by combining Settings, Account layout, and messaging
fixtures. The messaging suite retains 14 distinct scenarios through both public hooks;
each still creates and removes its own RxDB database. Four browser cases now share an
existing scenario's page load while retaining their assertions. Required CI gates and
parallelism are unchanged.

The [assertion survival map and measured results](TEST_SUITE_TRIM.md) identify every
removed case's replacement. Keep real gesture/layout checks in Playwright; DOM class
assertions are not substitutes for them. Focused verification now filters deleted paths
only from ESLint arguments, preserving the full diff base for test selection and broad
verification intent. The Home search wiring test uses a local calendar date so UTC and
Asia/Manila agree without forcing all tests into UTC.
