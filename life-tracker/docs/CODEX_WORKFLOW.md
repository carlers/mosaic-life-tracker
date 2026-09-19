# Codex workflow for Mosaic

Open `life-tracker/` as the VS Code workspace and run commands from that directory.
The parent directory remains the Git root, but it contains no Codex instruction file.
`life-tracker/AGENTS.md` is therefore the project's sole `AGENTS.md`.

## Start a task

1. Choose a roadmap batch or describe a focused outcome.
2. Ask Codex to inspect the relevant code, `AGENTS.md`, `SESSION_STATE.md`, and the
   matching part of `PLAN.md` before it edits.
3. Review the model and reasoning recommendation at the start of the response. Select
   it in the model control beneath the Codex composer if you want to switch. The
   recommendation does not pause or alter the active session by itself.
4. For an ambiguous or architectural batch, agree on a plan before requesting
   implementation. For a well-defined fix, ask Codex to implement and verify it directly.

Current OpenAI guidance recommends using the lowest reasoning effort that reliably
handles the task, raising it for deeper planning and analysis. See
[Models](https://learn.chatgpt.com/docs/models).

## During implementation

Codex owns the agreed batch end to end: targeted inspection, direct workspace edits,
appropriate tests, failure repair, diff review, and progress updates. You can steer the
active task from the same conversation. Routine file placement, naming, and reuse of
existing patterns do not need checkpoints.

"Proceed" or "continue" accepts Codex's most recent concrete recommendation; it
should execute that scoped step without another approval question. The default is
thorough verification and the safer implementation, closing related issues within
scope rather than adding avoidable backlog. Ask explicitly when speed should take
priority. This does not authorize unrelated batches or unmentioned external actions.

Codex asks when a decision changes user-visible behavior, architecture, schema or remote
state, an external contract, or the safety of a destructive action. It stops at the end
of the batch unless the request already authorizes further work.

## Review the result

The completion response should give you:

- the behavior or documentation changed;
- checks run and their results;
- material risks or remaining manual checks;
- a short verification protocol for user-visible work;
- the recommended model and reasoning effort for the next task.

Inspect the in-editor diff before committing. Commits, pushes, deployments, Appwrite
Console changes, and the next roadmap batch remain separate actions unless explicitly
included in the request.

Once verification passes, Codex recommends a concise conventional commit message. When
the extension supports native approval buttons for the concrete Git command, that
approval prompt is the commit confirmation. Otherwise Codex asks:
`Commit these changes with "<message>"? (yes/no)`. Approval authorizes staging only the
task's changed paths and creating that commit. If the implementation request already
explicitly authorized a commit, Codex skips the repeated question and commits after the
checks pass. Pushes and deployments always remain separate unless explicitly authorized.

## Resume in a new chat

Start a fresh chat from the `life-tracker/` workspace and ask Codex to read
`AGENTS.md`, `SESSION_STATE.md`, and the current item in `PLAN.md`, then resume from
`Next action`. Git holds the actual change history; the session file only carries the
small amount of context that is not obvious from code and the roadmap.

Update `SESSION_STATE.md` at a meaningful checkpoint, before a handoff, or when a
blocker or temporary decision would otherwise be lost. Do not turn it into a changelog.

## Suggested prompts

Planning:

```text
Read AGENTS.md, SESSION_STATE.md, and the current PLAN.md batch. Inspect the relevant
code, then propose a decision-complete implementation plan. Do not edit yet.
```

Implementation:

```text
Implement the agreed batch. Inspect the current worktree, edit directly, run the
appropriate checks, fix failures, review the diff, and update project state. Stop
before the next batch or any commit/push/deploy.
```

Resume:

```text
Read AGENTS.md, SESSION_STATE.md, and PLAN.md. Resume the current task from Next action.
```
