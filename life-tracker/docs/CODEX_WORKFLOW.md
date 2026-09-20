# Workspace-agent workflow for Mosaic

This is the direct-workspace workflow for an AI agent that can inspect files, edit the
repository, run commands, and use Git. Codex local/IDE and Codex Cloud are current
examples. Run project commands from `life-tracker/`, the directory containing
`package.json`, `AGENTS.md`, `PLAN.md`, and `SESSION_STATE.md`; its absolute path may vary.

## Start a task

1. Choose a focused outcome or roadmap batch.
2. Inspect `AGENTS.md`, `SESSION_STATE.md`, the relevant `PLAN.md` batch, current files,
   and `git status` before editing.
3. Review the opening task-complexity profile. If the active surface exposes model or
   reasoning controls, its optional recommendation may be used. If it does not, continue
   with the platform-selected configuration without pausing or treating it as a blocker.
4. Plan first for ambiguous architecture; implement a defined fix directly.

Canonical start:

```text
Use the Mosaic workspace-agent workflow. Inspect AGENTS.md, SESSION_STATE.md, PLAN.md,
Git, and the current files; verify the checkpoint, then continue from Next action.
```

`npm run handoff -- agent` validates state and prints this prompt.

## Own the batch

The agent owns targeted inspection, direct edits, tests, failure repair, diff review, and
state updates. Ask only when a decision changes product behavior, architecture, schema or
remote state, an external contract, or destructive safety. Stop at the agreed boundary.

Model availability is not part of the workflow contract. On a fixed-model surface such as
Codex Cloud, complexity changes planning depth, batch size, and verification—not the
underlying model. Prompt text cannot change model or reasoning settings.

## Local and cloud continuity

A local session may resume from the same checkout, including complete dirty files. A new
cloud task or unrelated workspace must not be assumed to share uncommitted state. For a
cross-container handoff, put the checkpoint on a GitHub-visible task branch and identify
the branch and commit in the handoff. Git carries exact files; `SESSION_STATE.md` carries
non-obvious intent and the next action.

A safe mid-task checkpoint has complete files, an accurate working set, explicit completed
and remaining substeps, and honest verification status. Do not begin another substep after
preparing a requested handoff. Never imply that a local-only checkpoint is portable.

## Switch workflows

The user may say:

```text
Prepare an agent handoff.
Prepare a planning-chat handoff.
Prepare an implementation-chat handoff.
```

Finish the current atomic operation, update `SESSION_STATE.md` when material state changed,
run the smallest useful check, and provide the transport:

| Destination | Transport |
|---|---|
| Same checkout | Current files, Git, and `SESSION_STATE.md` |
| Another workspace/cloud task | Pushed task branch and checkpoint commit |
| Web/mobile planning chat | `npm run handoff -- chat-plan` |
| Web/mobile implementation chat | `npm run handoff -- chat-implement` |

To resume in a workspace agent, use `npm run handoff -- agent`. To generate a packet in an
environment without file transfer, append `--stdout`. The destination verifies the
checkpoint before editing and continues from `Next action`; it does not repeat completed
work merely because the provider changed.

## Rate and context-limit recovery

Every completed turn is a recovery boundary. Before a limit becomes critical, stop starting
new work, finish or unwind the current atomic operation, leave complete files, update state,
and emit the handoff footer. If interruption occurs mid-turn, recover from the previous
completed response and inspect actual Git/files; no process can preserve uncheckpointed
edits held only by an interrupted agent.

Cross-container recovery additionally requires a pushed checkpoint or a verified external
artifact. An ignored file that exists only in an expired cloud container is not portable.

## Review and completion

Report behavior changed, exact checks and results, material risks/manual verification,
commit status, PR status when applicable, and the next-task complexity profile. A model or
reasoning recommendation is optional and only actionable where controls exist.

Before the acceptance gate, follow `docs/TEST_WORKFLOW.md`: inventory behavioral changes,
map each to direct, indirect, red-green, manual, skipped, or not-applicable evidence, run
`npm run metrics -- evidence-check --task <id>`, and emit its one-paragraph factual
summary. Capture red during focused development when possible. The isolated `test:red`
worktree command is a fallback, not a reason to rewrite history or disturb the active
checkout. Do not make an adequacy judgment. If the gate leads to more code changes, update
the evidence review before the next gate attempt.

Stage only task paths and preserve unrelated changes. Follow higher-priority task
instructions for commit and PR behavior. Otherwise commits, pushes, deployments, remote
Console actions, and the next roadmap batch remain separate actions.

Update `SESSION_STATE.md` at meaningful checkpoints, not merely to record a response. Git
holds branch, commit, and worktree truth. `PLAN.md` changes only after verified delivery.

## Rolling emergency handoff

End every turn-ending response with the compact metrics line defined in
`docs/WORKFLOW_TELEMETRY.md`, followed by the recovery footer. Use the local metrics CLI
when available and use `?` rather than guessing unavailable usage. Unchanged state without
initialized telemetry uses:

```text
**Run:** task=<id> · telemetry=off
**Handoff:** Agent: resume from `SESSION_STATE.md` + Git · Chat: `npm run handoff -- chat-plan`
```

After material work, use no more than three short lines: checkpoint, agent resume, and the
appropriate `chat-plan` or `chat-implement` command. For a portable cloud checkpoint, name
the pushed branch/commit; otherwise label it local-only. Keep full prompts in the generator
so the footer remains token-efficient.
