# Test workflow

Mosaic keeps full verification as the completion gate while providing smaller commands
for the edit/fix loop. Run commands from `life-tracker/`.

The suite protects durable product, data-safety, accessibility, and browser-behavior
contracts. It must not freeze incidental JSX, Tailwind, DOM nesting, or today's visual
composition. A test that makes harmless UI customization expensive is a defect in the test
unless the exact visual/layout property is itself an explicit product contract.

## Test architecture

Use the cheapest layer that can decisively prove the requirement:

| Layer | Owns | Does not own |
|---|---|---|
| unit | pure logic, mappings, IDs, validation, queues, sync algorithms, formatting | rendered JSX/layout |
| handlers | authz/authn, validation, cross-user server writes, pagination, destructive server behavior | client presentation |
| DOM | user actions, state transitions, accessible semantics, integration between real React boundaries | Tailwind/class structure or browser geometry |
| browser | browser history/focus, gesture arbitration, scrolling/overflow, real layout/geometry, accessibility scans, browser-network privacy contracts | behavior already decisively proven below |
| performance | diagnostic timing/frame/long-task measurements | release correctness unless a reviewed numeric budget is explicitly adopted |
| manual/device | OS Back, installed-PWA lifecycle, real touch/device behavior, hosted-service evidence | automated claims |

Prefer one decisive acceptance layer plus narrow lower-level tests for algorithms. Duplicate
coverage at several layers is justified only when each layer protects a different failure
mode.

### UI assertion admission rule

For UI tests, assert what a user or assistive technology can observe:

- roles, names, labels, values, checked/selected/disabled/current state
- content appearing/disappearing after an action
- focus and keyboard behavior
- callbacks or domain state produced by an interaction
- navigation/history outcomes
- browser-measured containment, overflow, or gesture ownership when those are the bug

Do **not** add or preserve assertions solely for:

- Tailwind or CSS class names
- exact DOM parent/child/sibling structure
- which wrapper owns typography, padding, flex, width, or overflow classes
- exact RGB values, spacing, border treatment, font size, or decorative transforms
- element ordering that has no behavioral/accessibility consequence
- `data-testid` existence when a semantic query can prove the requirement
- snapshots of broad component markup

Exceptions require a durable requirement that makes the presentation itself behavior.
Even then, assert the observable invariant rather than the implementation when possible.
Examples: a switch thumb remains inside its track; a page has no horizontal overflow at a
supported viewport; a six-week calendar does not clip its last row. Do not assert the
specific utility classes used to achieve those outcomes.

`data-testid` is acceptable for otherwise non-semantic gesture/scroll/measurement surfaces
and test harness outputs. It is a locator, not a reason to test implementation structure.

### Browser-contract admission rule

Playwright is deliberately scarce because it dominates canonical wall time. A browser test
belongs in `test:browser-contract` only when the decisive failure depends on a real browser
engine: layout/geometry, focus, scrolling, pointer/touch arbitration, browser history,
accessibility scanning, service-worker/browser APIs, or intercepted browser-network
contracts.

Before adding a browser case, ask whether an existing browser contract can absorb the new
assertion without another full setup, and whether a DOM/unit test can prove it instead.
Do not mirror every DOM regression in Playwright.

Performance probes are diagnostic and run via `npm run test:performance`; they are not
part of canonical acceptance unless the repository explicitly adopts a reviewed performance
budget.

## Fast loop

Start with the narrowest relevant command:

```bash
# One file (fastest feedback)
npm test -- tests/unit/sync.test.ts

# One behavior in a file
npm test -- tests/unit/sync.test.ts -t "pull pagination"

# One project
npm run test:unit
npm run test:handlers
npm run test:dom

# Browser-only correctness contracts
npm run test:browser-contract

# Diagnostic browser performance probe (not a correctness gate)
npm run test:performance
```

Use `test:unit` for pure helpers and local libraries, `test:handlers` for Appwrite
Function handlers, and `test:dom` for React hooks, providers, and components. Watch-mode
variants are `test:watch:unit`, `test:watch:handlers`, and `test:watch:dom`.

### GitHub-connected fast loop

Ordinary pushes to AI-owned `chatgpt/**` and `codex/**` branches use the least expensive
safe remote loop. Quality Gate is push-driven rather than duplicated on `pull_request`, so
each pushed commit gets one classification/verification run instead of separate push and PR
runs. Changes limited to project Markdown/`docs/**` run contract/link and diff checks only.
Other ordinary pushes run `scripts/verify-focused.mjs` against the push's real before-SHA:
contracts/discovery always run, ESLint receives changed code files, and Vitest selects tests
related to those changes. Use `[verify:browser]` on an intermediate commit only when the
change needs real-browser feedback.

Use `[verify:full]` on the exact final task commit. The remote canonical gate then runs
static/lint, unit, handler, DOM, production build/PWA/size, and browser correctness
contracts as parallel jobs and emits `canonical-acceptance` only when all pass. The
diagnostic performance probe is excluded. That exact green SHA is accepted on the source
branch after canonical acceptance; Vercel deploys only the configured stable branches.

Use the remote canonical gate for final acceptance when available; do not duplicate the
whole suite locally. See [delivery](DELIVERY.md).

## Spec-first TDD rule

For a new feature, changed product behavior, or bug regression, start from the governing
product/architecture requirement rather than the current implementation. When practical:

1. Write or strengthen the narrowest acceptance/regression test **before** the product
   implementation.
2. Run it against the incomplete/broken behavior and capture a `behavioral-red` failure
   that proves the assertion can detect the defect. A wholly new surface may begin with a
   `structural-red`.
3. Implement only enough product behavior to satisfy that requirement.
4. Run the focused test green, then run the broader repository gate as the regression
   check.

A test is not useful merely because it executes new code. Its decisive assertion must
describe an externally observable contract from `PROJECT_REFERENCE.md`, `AGENTS.md`,
another authoritative spec, or an explicit task-acceptance requirement. Assertions that
mirror private state, component structure, class lists, or helper implementation are not
acceptance evidence unless that exact structure is the documented contract.

For cross-component UI behavior, at least one acceptance layer must cross the boundary
being validated. A component test that mocks the child responsible for the behavior is
wiring coverage only; it cannot by itself prove that the integrated UI renders, scrolls,
or gestures correctly.

### Regression-test maintenance rule

When a harmless product refactor breaks a test, first ask whether the behavior changed.
If the user-visible/domain contract is still satisfied and only markup/classes/nesting
changed, fix or delete the brittle test rather than changing production code to satisfy it.

Do not add a regression test for every fixed line. Add one when it protects a meaningful
failure mode that could recur. Prefer table-driven coverage for families of equivalent
validation/mapping cases rather than many near-identical `it()` blocks.

Periodically remove tests whose only remaining purpose is enforcing historical design
choices. Git history is the archive for old implementation decisions.

## Data-safety coverage

Do not trade data safety for suite size. Strong direct coverage remains expected for:

- account isolation and authentication/offline identity
- sync pull/push boundaries, pagination, conflict/race behavior, tombstones, and mappings
- destructive deletion and retention behavior
- Appwrite Function authorization and cross-user writes
- message/social outboxes and retry/drop semantics
- stable row-ID rules and schema/remote parity
- privacy-minimal analytics/network contracts

These suites may be verbose when the state space is genuinely different. Refactor fixtures
or parameterize equivalent cases for readability, but do not remove distinct safety
conditions merely to reduce test counts.

## Optional test-evidence review

For an explicitly requested evidence audit, inventory the batch's externally observable
behavioral changes. Do not list files, functions, or refactor mechanics as behavior. Give
each behavior a stable task-local ID and requirement source, then record one current
evidence status:

| Status | Meaning | Required evidence |
|---|---|---|
| `existing-direct` | An existing assertion directly verifies the behavior | Test path and exact test name |
| `existing-indirect` | Existing execution reaches it without a decisive assertion | Test path and exact test name |
| `added-red-green` | A new/strengthened test demonstrated red then green | Test path/name, command, red class/signature, green result |
| `manual` | Credible verification requires a browser, device, deployment, or remote service | Reason and exact protocol |
| `skipped` | Verification was intentionally unavailable in this task | Reason |
| `not-applicable` | The change has no runtime behavioral contract | Reason |

The evidence check validates completeness, not adequacy. An automated row names the exact
behavior and decisive assertion. Merely executing code, belonging to a broad suite,
producing a snapshot without a relevant assertion, or increasing line coverage is not
`existing-direct` evidence.

### Red classifications

- `behavioral-red` — the relevant surface executes and fails the intended assertion.
- `structural-red` — a missing module/export/route or compilation failure prevents the
  behavior from executing.
- `unrelated-red` — environment, dependency, network, timeout, fixture, or pre-existing
  failure. It is never regression evidence.
- `unexpected-pass` — the candidate test passes against the base; it does not prove the
  test detects the change.

Prefer recording red when the test is authored. Do not recreate history merely to
manufacture red evidence.

When needed, the isolated fallback overlays only named test files onto a detached worktree
at the base commit:

```bash
npm run test:red -- --base <commit> --test tests/unit/example.test.ts --allow-dirty
npm run test:red -- --base <commit> --test tests/unit/example.test.ts --pattern "rejects invalid input" --allow-dirty
```

## Interaction regression coverage

Keep browser coverage focused on browser-only failure modes. Current durable examples are:

- Bottom-sheet Back consumes nested layers top-first and restores normal history afterward.
- A calendar swipe changes the calendar without advancing the friend/person carousel, while
  a swipe outside the calendar can advance the friend/person carousel.
- Nested Todo/Day View gestures do not leak to their parent carousel.
- Message sending preserves composer focus.
- Day View can close and reopen on another or the same day without stale browser state.
- Supported narrow viewports do not produce page-level horizontal overflow.
- Browser accessibility contracts have no detectable non-visual WCAG A/AA violations.

DOM tests may support these behaviors but do not replace real-browser evidence where
geometry/history/focus is the failure mode. Samsung/Android OS Back and real touch
recognizers remain manual hosted-Preview evidence when a task changes those surfaces.

## Discovery guard

`npm run verify` runs `npm run test:discovery` before lint/test/build. The guard fails
when any `tests/**/*.test.ts` or `tests/**/*.test.tsx` file belongs to zero or multiple
Vitest projects. Playwright correctness contracts use `tests/e2e/**/*.spec.mjs` and are
filtered by `test:browser-contract`; diagnostic performance cases carry the
`@performance` tag and are selected by `test:performance`.

The project patterns and Vitest configuration share `scripts/lib/test-projects.mjs` so
the guard cannot silently drift from the runner.

## Benchmark

`npm run test:benchmark` runs unit, handler, DOM, and full Vitest suites and reports
median wall time. Use at least three runs for timing decisions; one run is only a smoke
check. Canonical browser timing comes from Quality Gate job logs because browser contracts
run on the same CI runner shape used for acceptance.

When optimizing the suite, compare wall time and runner critical path rather than celebrating
a lower raw test count. Fewer tests are useful only when confidence is preserved or improved.

Historical timings and assertion maps remain available in Git history.
