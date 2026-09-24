# Test workflow

Mosaic keeps full verification as the completion gate while providing smaller commands
for the edit/fix loop. Run commands from `life-tracker/`.

## Fast loop

Start with the narrowest relevant command:

```bash
# One file (fastest feedback)
npm test -- tests/unit/createHandoff.test.ts

# One behavior in a file
npm test -- tests/unit/sync.test.ts -t "pull pagination"

# One project
npm run test:unit
npm run test:handlers
npm run test:dom
```

Use `test:unit` for pure helpers and local libraries, `test:handlers` for Appwrite
Function handlers, and `test:dom` for React hooks, providers, and components. Watch-mode
variants are `test:watch:unit`, `test:watch:handlers`, and `test:watch:dom`.

### GitHub-connected fast loop

Ordinary pushes to an AI-owned `chatgpt/**` branch use the least expensive safe remote
loop. Changes limited to project Markdown/`docs/**` run contract/link and diff checks only.
Other ordinary pushes run `scripts/verify-focused.mjs` against the push's real before-SHA:
contracts/discovery always run, ESLint receives changed code files, and Vitest selects tests
related to those changes. Use `[verify:browser]` on an intermediate commit only when the
change needs real-browser feedback.

Use `[verify:full]` on the exact final task commit. The remote canonical gate then runs
static/lint, unit, handler, DOM, production build/PWA/size, and browser contracts as
parallel jobs and emits `canonical-acceptance` only when all pass. That exact green SHA is
fast-forwarded to Preview; Preview checks prior acceptance instead of repeating the suite.

Before completing a shared or production-path batch, run the full required gate from
`AGENTS.md`: lint, all Vitest projects, and build as applicable. Targeted commands
accelerate iteration; they do not replace final verification.

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

A test is not a useful TDD acceptance test merely because it executes new code. Its
decisive assertion must describe an externally observable contract from
`PROJECT_REFERENCE.md`, `AGENTS.md`, another authoritative spec, or an explicit
task-acceptance requirement. Avoid assertions that simply mirror private state, current
component structure, implementation-specific class lists, or helper algorithms unless
that structure is itself the documented contract.

For cross-component UI behavior, at least one acceptance layer must cross the component
boundary being validated. A component test that mocks the child responsible for the
behavior is useful wiring coverage, but it cannot by itself prove that the integrated UI
renders, scrolls, or gestures correctly. Use a real integration DOM test or a browser
contract for that requirement.

Focused spec-first tests are the implementation loop. The full Vitest/build/browser suite
is the regression gate after the focused behavior is green. If writing the test first is
not practical, record the reason in the evidence review rather than manufacturing a red
state afterward.

## Test-evidence review

After focused implementation checks are green and before the acceptance gate, inventory
the batch's externally observable behavioral changes. Do not list files, functions, or
refactor mechanics as behavior. Give each behavior a stable task-local ID and requirement
source, then record one current evidence status:

| Status | Meaning | Required evidence |
|---|---|---|
| `existing-direct` | An existing assertion directly verifies the behavior | Test path and exact test name |
| `existing-indirect` | Existing execution reaches it without a decisive assertion | Test path and exact test name |
| `added-red-green` | A new/strengthened test demonstrated red then green | Test path/name, command, red class/signature, green result |
| `manual` | Credible verification requires a browser, device, deployment, or remote service | Reason and exact protocol |
| `skipped` | Verification was intentionally unavailable in this task | Reason |
| `not-applicable` | The change has no runtime behavioral contract | Reason |

The evidence check validates that every declaration has a complete row. It does not decide
whether coverage is adequate. It does not reject a row merely because it is indirect,
manual, skipped, or not applicable. The user adjudicates the reported evidence.

An automated row names the exact `describe`/`it` behavior and decisive assertion. Merely
executing code, belonging to a broad suite, producing a snapshot without a relevant
assertion, or increasing line coverage is not `existing-direct` evidence.

### Red classifications

- `behavioral-red` — the relevant surface executes and fails the intended assertion.
- `structural-red` — a missing module/export/route or compilation failure prevents the
  behavior from executing. This is acceptable for a wholly new surface but is labeled.
- `unrelated-red` — environment, dependency, network, timeout, fixture, or pre-existing
  failure. It is never regression evidence.
- `unexpected-pass` — the candidate test passes against the base; it does not prove the
  test detects the change.

Prefer recording red when the test is authored: run the narrow test against the incomplete
implementation, retain its normalized failure signature, finish the implementation, then
run the same command green. Do not recreate history merely to manufacture red evidence.

When that evidence was not captured, the isolated fallback overlays only named test files
onto a detached worktree at the base commit:

```bash
npm run test:red -- --base <commit> --test tests/unit/example.test.ts --allow-dirty
npm run test:red -- --base <commit> --test tests/unit/example.test.ts --pattern "rejects invalid input" --allow-dirty
```

Without `--allow-dirty`, the command refuses an active dirty project. With it, only the
declared test and repeated `--fixture tests/...` files are copied; product source is never
overlaid. The command links the active `node_modules`, runs one focused Vitest target,
classifies the result, emits JSON, and removes the worktree even after failure. A missing
new implementation normally produces `structural-red`, not behavioral proof.

### Requirement citations

Regression tests added for this review cite the narrowest stable contract:

```ts
// Regression: §24.13 (explicit PWA update activation)
// Regression: AGENTS.md — Non-negotiable data and sync rules
// Regression: task acceptance PWA-UPDATE-1
```

Move a task-local citation to `docs/PROJECT_REFERENCE.md` when the behavior becomes a
durable product or architecture contract. Ordinary tests do not need comments unless they
pin a documented regression, rule, or acceptance behavior.

### Telemetry commands

```bash
npm run metrics -- behavior --task <id> --id EVIDENCE-1 --statement "Invalid evidence is rejected" --requirement "AGENTS.md — Definition of done"
npm run metrics -- evidence --task <id> --behavior EVIDENCE-1 --status added-red-green --test tests/unit/example.test.ts --name "rejects invalid evidence" --command "npm test -- tests/unit/example.test.ts" --red behavioral-red --red-signature "expected function to throw" --green pass
npm run metrics -- evidence-check --task <id>
```

Manual rows add `--reason` and `--protocol`; skipped/not-applicable rows add `--reason`.
The final output is one factual paragraph containing behavior/status counts, behavioral
versus structural red counts, focused/acceptance results, and manual/skipped reasons. It
ends with: `No judgment of overall suite sufficiency is made here.`

If the acceptance gate reveals a defect and code changes, revise the behavior/evidence map
and rerun the evidence check before the next acceptance attempt.

## Interaction regression coverage

Interaction changes that depend on nested modal or carousel ownership need focused regression
coverage in addition to the canonical Vitest/build gate. Browser-backed contracts live in
`tests/e2e/**/*.spec.mjs`, are discovered by `npm run test:browser-contract`, and run as
the parallel `browser-contract` job inside the single GitHub `Verify` workflow. Do not
create a separate Actions workflow for them.

- Bottom-sheet Back tests should cover one, two, and three open layers, assert top-first
  dismissal, preserve the route while any sheet remains, and verify that normal navigation
  resumes only after the stack is empty. Include rapid/repeated Back sequences where the
  implementation is sensitive to animation or effect cleanup.
- Nested carousel tests should assert both sides of ownership: a swipe beginning in the
  calendar changes the calendar without advancing the friend/person carousel, while a swipe
  outside the calendar can still advance the friend/person carousel.
- DOM tests establish application event/history behavior, but Samsung/Android OS Back and
  real touch recognizers remain manual hosted-Preview evidence; do not relabel them as fully
  automated merely because synthetic popstate or pointer tests pass.

## Discovery guard

`npm run verify` runs `npm run test:discovery` before lint/test/build, and the focused
command remains useful immediately after adding or moving a test. The guard fails when any
`tests/**/*.test.ts` or `tests/**/*.test.tsx` file belongs to zero or multiple Vitest
projects. Playwright contracts use the separate `tests/e2e/**/*.spec.mjs` convention and
are directory-discovered by `npm run test:browser-contract`.
The project patterns and Vitest configuration share `scripts/lib/test-projects.mjs` so
the guard cannot silently drift from the runner.

## Benchmark

`npm run test:benchmark` runs unit, handler, DOM, and full suites three times and reports
median wall time. Narrow a benchmark with, for example:

```bash
npm run test:benchmark -- --suite dom --runs 1
```

Use at least three runs for decisions; a one-run command is only a smoke test. Generated
results are console output and are not committed.

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
