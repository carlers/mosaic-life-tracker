# Workflow telemetry

Mosaic records local, provider-neutral workflow events so its development process can be
measured without storing prompts, responses, source contents, secrets, or user data. The
ledger is optional, local-only, and ignored by Git at `.mosaic/metrics/events.jsonl`.

## Principles

- Record facts, then derive metrics. Agents append gate results and repository snapshots;
  they do not guess loop totals.
- Unknown values are `null` or `?`, never zero. Estimated token values use `~` in output.
- Exact and estimated token values retain their provenance and must not be combined into
  an unlabeled exact average.
- Optimize for solved, verified tasks. Lower token use is not an improvement when intent
  defects, incomplete work, flaky checks, or handoff friction increase.
- Compare like with like: segment by task profile, workflow version, execution surface,
  model identifier when exposed, and change-size band.

## Task and event model

A `task_id` is stable across agent/chat handoffs. A task starts as `active` and ends as
`solved`, `blocked`, or `abandoned`; `solved` requires the task's acceptance gate or an
explicitly documented exception. Each completed response may record a `turn_id`.

The JSONL ledger uses schema and workflow versions. Events include timestamps and may
include the starting Git commit, dirty state, repository snapshots, gate scope, check
commands, review findings, handoffs, and token receipts. It deliberately excludes the
contents of prompts, responses, diffs, source files, and environment variables.
Repository snapshots retain only paths, line counts, binary flags, and short content
hashes so content-only edits are distinguishable without storing source text.

`behavior_declared` and `test_evidence` events add the test-evidence map described in
`docs/TEST_WORKFLOW.md`. They store short statements, requirement citations, test names,
normalized red signatures, and manual/skip reasons—not full logs or source content.
These additions use schema/workflow version 2; readers retain schema-1 compatibility so an
active task can cross the upgrade boundary without losing its earlier local events.
If an old snapshot cannot distinguish a content-only edit, `correct-loop` appends an
auditable `loop_corrected` event with the original gate ID and reason; raw history is never
rewritten.

### Verification scopes

| Scope | Meaning |
|---|---|
| `focused` | One affected test, lint target, or narrow check used during editing |
| `project` | A scoped suite such as `test:unit`, `test:handlers`, or `test:dom` |
| `acceptance` | The complete task-appropriate gate required by `AGENTS.md` |
| `manual` | A documented browser, device, or remote-service protocol |

First-gate green refers only to the first complete `acceptance` attempt. Focused checks
remain valuable iteration data but do not independently mark a task solved.

## Repair and retry taxonomy

The ledger derives these classifications from ordered events:

| Tag | Sequence | Interpretation |
|---|---|---|
| `v` | gate red → relevant repository change → same gate green | Verification repair |
| `i` | gate green → accepted review finding against a pre-existing requirement → change → verification | Intent repair |
| `f` | gate red → no relevant repository/environment change → same gate green | Suspected flaky retry |
| `u` | verification interrupted by an environment/dependency/credential/resource condition | Infrastructure retry |

`repair_loops = v + i`. Flaky and infrastructure retries remain separate because they
are not code-repair loops. A rerun without a change is not `v`. A new requirement,
optional improvement, or unresolved reviewer preference is not `i`. Intent findings must
name their reviewer type, requirement source, category, acceptance state, and whether the
requirement existed before the green gate.

No loop count is universally normal. Compare it with the task profile and change size.
Repeated instances of the same failure deserve more attention than unrelated failures.
After two unsuccessful relevant edits for the same failure, reassess the diagnosis; after
three failed acceptance attempts, revisit the plan and task contract.

## Cadence

Cadence is measured from repository snapshots, not an agent-authored edit count. The
compact summary reports files and changed lines before the first verification, for
example `4f/144Δ`. Full reports should separate implementation, tests, documentation,
configuration, binary, and generated files where possible. Pre-existing changes form part
of the starting snapshot and are not attributed to the task.

There is no global healthy cadence target. Compare medians within the same task profile
and change type. A coordinated migration may correctly touch many files before its first
useful gate, while a routine fix generally should not.

## Tokens and prompt caching

Token provenance is one of `provider_exact`, `client_exact`, `estimated`, or
`unavailable`. Surfaces that do not expose usage must record `unavailable`; model-written
guesses are not exact telemetry.

When supported, retain input, output, cache-read, and cache-write tokens independently.
The compact cached-token ratio is `cache_read_tokens / input_tokens`. Request hit rate is
only meaningful when records also declare cache eligibility. Do not aggregate unlike
providers or workflow versions into a single headline cache rate.

## CLI

Initialize a task before material work:

```bash
npm run metrics -- start phase-3.5 --profile complex --surface workspace-agent
```

Record verification after each attempt. Commands are pipe-delimited so one acceptance
attempt can represent the complete gate:

```bash
npm run metrics -- gate --task phase-3.5 --scope focused --result fail --commands "npm test -- tests/unit/example.test.ts"
npm run metrics -- gate --task phase-3.5 --scope focused --result pass --commands "npm test -- tests/unit/example.test.ts"
npm run metrics -- gate --task phase-3.5 --scope acceptance --result pass --commands "npm run lint|npm test|npm run build"
```

Optional usage, review, environment, and handoff events use `turn`, `review`,
`environment`, and `handoff`. The normal `npm run handoff -- <target>` command records a
handoff automatically when a telemetry task is active. Finish and summarize with:

```bash
npm run metrics -- end phase-3.5 --result solved
npm run metrics -- summary --task phase-3.5
npm run metrics -- summary --task phase-3.5 --json
```

A solved task requires a recorded passing acceptance gate. When an acceptance check is
genuinely unavailable, `end` also accepts `--exception "reason"`; use that auditable escape
hatch rather than silently treating an incomplete gate as green.

Before the acceptance gate, record behavior/evidence rows and run:

```bash
npm run metrics -- evidence-check --task phase-3.5
```

The check enforces complete status-specific fields without deciding whether indirect,
manual, or skipped evidence is acceptable. When behaviors exist, the compact Run line and
handoff packet include `evidence=<documented>/<declared>`.

## Compact response line

Every turn-ending response places one deterministic line above the handoff:

```text
**Run:** task=phase-3.5 · gate=green@1 · loops=v0/i0 · retry=f0/u0 · cadence=4f/144Δ · tok=? · cache=?
**Handoff:** Agent: resume from `SESSION_STATE.md` + Git · Chat: `npm run handoff -- chat-plan`
```

`?` means unavailable and `~` marks an estimate. If a task has not initialized telemetry,
use `**Run:** task=<id> · telemetry=off`. Detailed event history stays in the local ledger;
the handoff packet carries only the current compact summary.

## Review cycle

Collect several solved tasks before drawing conclusions. Segment the data, identify one
bottleneck, change one workflow variable, increment the workflow version, and compare
medians plus correctness/failure rates. Retain raw events locally and publish only
anonymized aggregates. Never trade a lower token total for more intent defects, repair
loops, incomplete tasks, or unreliable verification.
