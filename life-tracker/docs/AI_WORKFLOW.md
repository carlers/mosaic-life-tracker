# AI workflow

## Shared loop

Read applicable AGENTS instructions, the [checkpoint](SESSION_STATE.md), and relevant
source. Read [roadmap](PLAN.md) only for sequencing and [reference](PROJECT_REFERENCE.md)
sections only for affected contracts. Inspect Git before edits; preserve unrelated work.
Complete the requested scope, run focused checks, repair failures, review the diff, and put
the durable checkpoint in the same final task commit. Batch remote edits; ordinary AI-branch
pushes are intentionally verification-free, so request `[verify:focused]` only on the
coherent task checkpoint before stable-Preview squash. Do not create a later status-only
checkpoint after CI turns green. Then follow [delivery](DELIVERY.md). No mandatory profiles,
model selection, response footers, verbatim prompt copies, or evidence ledger. [Telemetry](WORKFLOW_TELEMETRY.md)
is optional. Batch independent reads and ask for missing files together.

## Issues as work intake

For "add to backlog", "plan issue #N", "critique issue #N", and "implement #N",
follow [GitHub Issues workflow](ISSUE_WORKFLOW.md). Explicit capture is a
lightweight GitHub write, not a development task or permission to implement.
Planning records the issue's intent and acceptance criteria without copying the
whole roadmap into every issue. An approved issue is read alongside the current
Git checkpoint, not substituted for repository contracts. Link the issue in task
PRs and keep the issue open until the documented acceptance/release boundary.
If GitHub issue tools are unavailable, return a copy-ready issue and state that
nothing was saved; never fabricate issue numbers, links, or updates.

## Preview version and promotion subject

New user-visible capabilities get a planned MINOR version; each later successfully delivered user-testable refinement gets one PATCH. A failed provider build consumes no new version. Reconcile reserved versions against main, dev and other active Preview branches; independent feature versions cannot collide. Apply the version in the **same task commit** as the deliverable changes, synchronize package.json, package-lock.json and src/lib/appVersion.ts with `npm run version:set -- X.Y.Z` or `version:bump`, and validate with `npm run version:check`. Never bump during an accepted stable Preview -> dev -> main promotion; changing the accepted tree mandates a fresh Preview acceptance. Follow [versioning](VERSIONING.md).

Every squash/promotion merge should have a descriptive `commit_title` and `commit_message` from the actual delivered diff, not a generic approval/branch description. Use a full body for the release changes and retain CI/provenance metadata in PR descriptions. The Settings commit display is expandable. No release tags before main CI and production deployment are green.

**Environment invariant:** official Vercel Preview (including dev) uses only registered Scratch Appwrite; official main uses only Production. Browser-facing `appwrite:` Settings metadata comes from actual SDK project + endpoint, not the branch. Use stable registered Preview aliases, not unregistered immutable deployment URLs. Follow [scratch Preview readiness](SCRATCH_PREVIEW_WORKFLOW.md) only for backend-dependent work, never add Appwrite delays to frontend-only changes.

## Environment selection

| Environment | Work and verification | Transfer |
|---|---|---|
| Codex local/IDE | Direct edits and focused terminal checks | Same checkout or pushed task commit |
| Codex cloud | Direct edits; inspect available network/tools | Pushed commit or exported exact files |
| Chat with GitHub access | Read exact branch/SHA; edit and inspect Actions only if those tools exist | GitHub reference packet |
| Chat without repository access | Supplied exact files; never claim executed checks | File packet and complete-file installer |

A connector name does not prove write, Actions, or deployment access. Inspect actual
tools once, use those available, and report specific missing capabilities. Read-only
connected chats can review/plan; implementation returns the file bundle below.
No environment change alters scope, data rules, or verification requirements.

## GitHub connector call budget

GitHub-connected Chat may use Code Mode/programmatic tool calling to batch reads and Git
object writes. Treat its orchestration budget as a separate constraint from GitHub API
payload limits.

On 2026-10-05 the current Chat harness was probed with harmless repeated reads: 20 nested
connector calls in one Code Mode execution succeeded, while 21 failed with
`Code Mode exceeded the maximum number of tool calls.` This is an observed harness value,
not a durable API contract. OpenAI's Responses API exposes a configurable
[`max_tool_calls`](https://developers.openai.com/api/reference/resources/responses/methods/create),
and this connected environment does not expose a remaining-call counter or the configured
ceiling to the agent. GitHub's Git-tree API is therefore not the limit that caused the
failure; loops do not bypass the Code Mode call budget.

Use this preflight rule instead of targeting the observed maximum:

1. Count every awaited connector call planned inside one Code Mode execution before running
   it. Local JavaScript and `text(...)` do not replace connector calls; each
   `tools.mcp__...` invocation consumes one.
2. Keep ordinary programs at **12 connector calls or fewer**. This leaves headroom if the
   host lowers its cap, a retry becomes necessary, or one extra validation call is added.
   If the plan exceeds 12, split it before execution.
3. Separate broad reads from writes. Do not fetch many files, create their blobs, create the
   tree, create the commit, and update the ref in one giant program.
4. For a multi-file GitHub write, create blobs in **blob-only batches of at most 12 calls**.
   Preserve the returned `{path, sha}` pairs, then use one final short program for
   `create_tree` + `create_commit` + `update_ref` (3 calls).
5. If attempting a genuinely small all-in-one write, use the formula
   `reads + blobs + 3` (tree, commit, ref) and require the result to be at most 12.
   Example: 19 changed files would require 22 write calls even with zero reads, so it must
   be split before execution.
6. Do not replace this with one `update_file` commit per file. That avoids the call budget
   only by creating noisy intermediate commits and CI/history churn. Prefer Git blobs +
   one tree + one commit + one ref move.
7. Keep the branch ref unchanged until the final commit exists. Successfully created but
   unreferenced blobs are harmless if a later batch fails; retry from the known branch head.
   Re-read the branch head before the final ref move. Use an expected-head/lease only when
   the current connector invocation accepts it; otherwise abort on any observed head drift
   rather than forcing the ref.
8. If a program at or below the 12-call safety limit ever reports a maximum-call error,
   assume the harness changed. Re-probe only with read-only calls, lower the local safety
   threshold, and update this section. Never discover the ceiling using side-effecting writes.

GitHub's [Git trees documentation](https://docs.github.com/en/rest/git/trees) remains useful
for endpoint validation and payload behavior, but it does not provide an agent-visible
Code Mode call counter. The practical optimization is therefore deterministic call
budgeting and phased Git-object writes, not trial-and-error giant patches.

## Connected-chat latency discipline

Connected Chat must optimize wall time and tool-call count as well as correctness. A task that
eventually passes after many repeated reads, polls, micro-branches, or stable-Preview rebuilds is
not an efficient execution.

1. **Read once per SHA.** Fetch each relevant source/doc file once for the current branch head,
   then inspect multiple symbols/hypotheses against that captured content. Re-fetch only after
   that file or branch head actually changes. Do not repeatedly fetch the same file for adjacent
   questions that can be answered locally from the first read.
2. **Verify dependency contracts before patching.** When a production-only failure touches a
   third-party API, inspect the repository's installed version/types/source before changing code.
   If a test double allowed the bug through, compare the double's method/return shape to the real
   dependency first; do not patch from memory or generic current docs alone.
3. **Batch known repairs.** Once root cause and related concerns are known, keep them on one task
   branch and one focused checkpoint. If stable Preview exposes a failure, diagnose the full
   failure set and batch the repair before the next squash. Avoid chains like `fix-2`,
   `headroom-3`, and `final-state` for issues already known at the same time.
4. **Preflight tight production budgets.** Before adding shipped runtime logic, inspect current
   build-size headroom. If aggregate/closure headroom is under about 1 KiB, or the task clearly
   grows a near-limit chunk, run the narrowest available production-size diagnostic before the
   first stable merge. In GitHub-only work, one explicit `[verify:full]` diagnostic is preferable
   to several failed stable-Preview rebuilds. Make one measured decision: trim meaningful waste or
   document/accept intentional growth. Do not byte-golf correctness through repeated sub-100-byte
   stable merges.
5. **Poll CI/deployments only when new evidence can exist.** Start Actions/Vercel, then use the
   wait for independent diff review, documentation review, or other checks. Poll Actions and
   deployment state together when possible. Do not issue immediate identical status calls while
   jobs are merely queued/running; after two unchanged status polls in the same phase, stop
   polling until other useful work has completed. Fetch full logs only for failure, an anomalous
   stall, or a specific diagnostic—not for ordinary progress.
6. **One stable acceptance cycle is the target.** Normal delivery is task focused green → one
   squash to stable Preview → one full canonical/Preview pass. When that pass fails, make one
   diagnosed repair batch before re-entering stable acceptance. Do not serially merge speculative
   one-line fixes and pay the full gate after each.
7. **Treat missing workflow runs as a trigger problem, not a polling problem.** After moving a
   branch ref, check once for the exact-SHA run. If no run exists, do not repeatedly query for the
   same missing run. Use an explicit workflow dispatch when available; otherwise use a genuinely
   meaningful remaining task change through the normal contents path or report the trigger/tool
   blocker. Never create a status-only commit solely to make CI fire.
8. **Verify programmatic transforms before commit.** Generated text edits are code. JavaScript
   replacement strings interpret special dollar tokens such as dollar-ampersand, dollar-apostrophe,
   and dollar-backtick; use a replacement
   callback or structured/full-file rewrite for literal content containing `$`. Re-read every
   transformed file or its exact diff before committing, especially docs/config generated by
   scripts.
9. **Re-diagnose after two unexpected cycles.** If the same layer fails twice after attempted
   fixes, stop incremental patching. Reconstruct the exact branch/SHA, failing contract, runtime
   type/API shape, and all related evidence, then form a new root-cause plan before editing again.
10. **Keep progress narration sparse.** User-visible updates belong at phase transitions,
    discoveries that change the plan, or genuine blockers. Do not narrate every queue poll. In
    connected Chat, batch remote calls aggressively enough that the orchestration itself does not
    become the timeout risk.

These rules complement the connector-call ceiling above: the call-budget section prevents one
oversized tool program, while this section prevents many individually valid calls from becoming a
slow task.

## Codex setup

Use Node 22; run `cd life-tracker && npm ci --prefer-offline --no-audit` for initial
setup or a changed lockfile. Reuse installed dependencies when the lockfile is unchanged.
For browser work, run `npm run test:browser:prepare` then
`tests/e2e/node_modules/.bin/playwright install --with-deps chromium` once in the environment.
Do not repeat installation on each agent turn.

Cloud setup/maintenance scripts must resolve the checkout directory rather than assume
this laptop's path. Configure setup for initial dependencies; maintenance should reinstall
only when the lockfile changed. Agent-phase network access is environment-dependent;
setup exports do not persist automatically. Keep credentials out of committed files.
See official [cloud environment guidance](https://learn.chatgpt.com/docs/environments/cloud-environment)
and [instruction discovery](https://learn.chatgpt.com/docs/agent-configuration/agents-md).

## Checkpoints and recovery

Checkpoint objective, constraints, completed/remaining work, working files, verification,
blockers, and next action at meaningful milestones or before switching. Keep files complete.
Git supplies branch and worktree truth; avoid redundant status prose. A checkpoint describes
recoverable work, not unpersisted reasoning. An expired cloud container cannot supply local-only files.
A requested handoff means finish the atomic operation, checkpoint, produce transport, and stop.

## Handoff commands

Run from `life-tracker/`:

```bash
npm run handoff -- agent
npm run handoff -- chat-plan
npm run handoff -- chat-implement --stdout
npm run handoff -- chat-plan --transport github
npm run dump -- src/path.ts tests/unit/path.test.ts
```

`agent` prints a resume prompt. Chat targets produce ignored `.mosaic-handoff.md`.
`chat-plan` is Planner/Reviewer; `chat-implement` is Implementer. Existing provider aliases
remain accepted. Extra positional paths extend the checkpoint working set.
File packets contain essential instructions, checkpoint, metadata, and selected exact files
once. No automatic full roadmap or duplicated diffs. Missing/deleted paths must be removed
from the working set; list deletions in completed/remaining work. Request missing exact files
before editing. A 20,000 estimated-token warning is advisory, never silent truncation.
`--stdout` emits the packet; diagnostics go to stderr. Clipboard is best-effort.

`--transport github` requires a clean checkout and origin's named branch at the exact
local SHA, verified with `git ls-remote`. It emits repository/branch/full SHA and paths,
not source contents. Dirty, detached, unpushed, or unreachable checkpoints fail with a
file-packet fallback. Remote consumers must retrieve that SHA, not trust search freshness.
Add `--telemetry` only when explicitly recording a handoff for an active metrics task.

## Offline implementation output

Return one complete block using five tildes and the `mosaic` tag. Include only changed
full files, optional deletions, the updated checkpoint last, and a conventional commit subject:

```text
~~~~~mosaic
===FILE:path/to/file===
<complete contents>
===DELETE:path/to/removed-file===
===FILE:docs/SESSION_STATE.md===
<complete checkpoint>
===COMMIT:type: concise subject===
~~~~~
```

Never send truncated files, placeholders, or invented source. Split large work only at
complete-file checkpoints. Paste into ignored `pending-changes.txt`:

| Command | Effect |
|---|---|
| `npm run apply:dry` | Validate without writing |
| `npm run apply -- --commit` | Back up, apply, verify, commit touched paths |
| `npm run apply:docs` | Apply prose-only changes without verification or commit; run contracts and commit separately |
| `npm run apply:start` | Apply, verify, start development server |
| `npm run apply:rollback` | Explicitly restore last backup |

Backups/pending files are user-owned. Failed verification leaves changes inspectable;
never apply a partial bundle. Installer commits are local; continue delivery from a
workspace or a connected surface with the required tools.
