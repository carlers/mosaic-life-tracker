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
