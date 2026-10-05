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
