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
not practical, report any material limitation without manufacturing a red state afterward.

## Optional test-evidence review

For an explicitly requested evidence audit, inventory
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
Detailed evidence reporting is opt-in; ordinary completion reports state checks and results.

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


Historical timings and assertion maps remain available in Git history.
The 2026-09-24 test consolidation delivered 594 Vitest cases / 93 files and 23 browser
contracts; tooling changes may add cases. Use discovery and runner output for current totals.
