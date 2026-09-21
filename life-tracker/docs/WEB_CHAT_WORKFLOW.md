# Web-chat workflow for Mosaic

This workflow applies to provider-neutral web chats. Some web chats only use compact input
packets and complete-file output, while GitHub-connected chats can inspect repository files,
edit through GitHub, and inspect remote verification results. The active capability determines
the transport method; the project contracts and verification rules remain the same.
ChatGPT, DeepSeek, and similar web or mobile chats are examples; provider and model names
do not change the contract.

## Roles

Every chat declares exactly one role:

- **Planner/Reviewer** (`chat-plan`) — produces a decision-complete plan or review and
  does not emit runtime changes.
- **Implementer** (`chat-implement`) — follows a decision-complete task, requests missing
  exact files together, and returns one installer-compatible full-file bundle.

If the role is omitted, start with Planner/Reviewer. Canonical starts are embedded in the
generated packet.

## Create compact context

From `life-tracker/`, ensure `SESSION_STATE.md` describes the latest safe checkpoint, then
run one of:

```bash
npm run handoff -- chat-plan
npm run handoff -- chat-implement
```

The command writes the ignored `.mosaic-handoff.md`, attempts to copy it, and prints the
start prompt. Attach or paste the file. In a cloud workspace without clipboard or file
transfer, use `--stdout`. Optional trailing paths add exact files to the packet.

The packet contains the role, shared rules, this workflow, session state, roadmap, Git
checkpoint, scoped diffs, and exact working files. It rejects missing or escaping paths,
external symlinks, and generated exports. Its token estimate is approximate across
providers; a warning above 20,000 tokens is advisory.

If context is missing, request all known paths together and have the user run:

```bash
npm run dump -- <path> [<path> ...]
```

Never guess missing source. `repomix --compress` is an audit fallback, not onboarding.

## Safe checkpoints and switching

Every completed AI turn is a potential workflow boundary. A checkpoint may be mid-task or
mid-batch, and may have a dirty worktree, when:

- every file is complete and syntactically coherent;
- completed and remaining substeps are recorded;
- `Working set` names the files required to resume;
- decisions, verification run, and verification pending are explicit; and
- the destination receives the exact current file contents.

Use Git for transfers between separate workspace agents or cloud containers. Use a packet
to enter web chat. Use a complete `mosaic` bundle to return changes to a workspace agent.
Conversation history is never the source of truth.

The user may say `Prepare an agent handoff`, `Prepare a planning-chat handoff`, or
`Prepare an implementation-chat handoff`. Finish the current atomic operation, update the
checkpoint, generate the requested transport, give the exact resume instruction, and stop.

If a rate or context limit is approaching, checkpoint before starting more work. If a turn
is interrupted before it can checkpoint, recovery starts from the last completed response:
another workspace agent inspects the available Git/worktree state, while chat uses the last
complete packet. Never apply a truncated response or partial bundle.

## Implementer output

The Implementer emits one fenced block using exactly five tildes and the `mosaic` tag. It
contains only changed full files, optional deletions, updated `SESSION_STATE.md` as the
final file, and a concise conventional commit message:

```text
<five tildes followed by mosaic>
===FILE:path/to/file===
<complete file content>
===DELETE:path/to/removed-file===
===FILE:SESSION_STATE.md===
<complete updated state>
===COMMIT:type: concise subject===
<five closing tildes>
```

Do not emit diffs, placeholders, elisions, escaped content, or nested mega blocks.
Directive-like lines inside ordinary Markdown fences are content; the installer is
fence-aware. If output might truncate, split only at complete-file/checkpoint boundaries
or request a smaller working set before emitting a bundle.

Paste a complete bundle into ignored `pending-changes.txt`, then use:

| Command | Purpose |
|---|---|
| `npm run apply:dry` | Parse and validate without writing |
| `npm run apply` | Back up, write, lint, test, build, then offer to commit |
| `npm run apply:docs` | Apply documentation without runtime verification |
| `npm run apply:start` | Apply, verify, and start the development server |
| `npm run apply:rollback` | Restore the latest `.mosaic-backup` snapshot |

The installer stages touched paths only. Failure leaves files for inspection; rollback is
explicit. Pending content and backups are user-owned.

## Test-evidence review

Before directing a workspace to run the acceptance gate, list behavioral changes and map
each to the statuses in `docs/TEST_WORKFLOW.md`. Preserve red/green evidence supplied in a
handoff packet; never claim that a web chat executed a test or isolated Git worktree. Mark
browser/device/remote behaviors as manual with an exact protocol and mark unavailable work
as skipped with a reason. Ask the workspace to run the evidence check and any missing
focused tests. End the review with the prescribed factual paragraph and make no judgment
that the suite is sufficient, adequate, or comprehensive.

## Rolling emergency handoff

Every turn-ending response ends with the provider-neutral metrics line defined in
`docs/WORKFLOW_TELEMETRY.md` and a token-efficient handoff. A web chat must preserve
authoritative values from its packet, may add exact values exposed by its UI, and must use
`?` rather than estimating hidden token/cache usage. When telemetry is unavailable:

```text
**Run:** task=<id> · telemetry=off
**Handoff:** Agent: resume from `SESSION_STATE.md` + Git · Chat: `npm run handoff -- chat-plan`
```

After material work, use at most three short lines naming the checkpoint, agent resume,
and either `chat-plan` or `chat-implement`. Full prompts belong in generated handoffs, not
every response. This guarantees recovery from the last completed response, not from edits
made during a later turn that fails before it can checkpoint.

## Compatibility aliases

`codex`, `chat`, `deepseek-chat1`, `deepseek-chat2`, `chatgpt-planner`,
`chatgpt-implementer`, `deepseek-planner`, and `deepseek-implementer` remain accepted
aliases. New instructions and automation use `agent`, `chat-plan`, and `chat-implement`.
