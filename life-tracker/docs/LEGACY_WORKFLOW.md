# DeepSeek Web workflow for Mosaic

This is a supported alternate workflow for periods when Codex usage is unavailable.
It shares project rules, roadmap, session state, working files, and Git history with
Codex. The word "legacy" describes the web-based transport and installer, not a retired
or lower-quality process.

## Select a role

Every DeepSeek session declares exactly one role:

- **Chat 1 — planner/reviewer.** Inspect the checkpoint, plan decision-complete work,
  audit results, and surface product or architecture questions. It does not emit runtime
  code. It may emit documentation-only mega files when state or plans need updating.
- **Chat 2 — implementer.** Follow a decision-complete task, request any missing exact
  files, and emit one full-file mega file for the current checkpoint. Runtime files,
  scripts, configuration, and package changes belong to Chat 2.

Canonical starts:

```text
You are DeepSeek Chat 1. Use the legacy workflow and resume from the attached handoff packet.
```

```text
You are DeepSeek Chat 2. Use the legacy workflow and resume from the attached handoff packet.
```

An explicit role activates this document. `AGENTS.md` still supplies all project,
architecture, safety, UI, and verification rules.

## Create compact context

From `life-tracker/`, update `SESSION_STATE.md` to a meaningful checkpoint and run:

```bash
npm run handoff -- deepseek-chat1
npm run handoff -- deepseek-chat2
```

The command writes the ignored `.mosaic-handoff.md`, attempts to copy it to the
clipboard, and prints the canonical start prompt. Attach the file to DeepSeek Web. The
packet contains:

- the selected role, shared rules, this workflow, session state, and roadmap;
- branch, HEAD, scoped Git status, and selected staged/unstaged diffs;
- exact contents of paths under `SESSION_STATE.md`'s `Working set`;
- exact contents of optional paths appended to the command.

The generator rejects missing files, paths outside the project, symlinks resolving
outside it, and generated repository exports. It estimates packet tokens and warns above
20,000 without blocking the handoff. Keep the state working set limited to files needed
at the next checkpoint.

If a needed file is absent, request all known paths together:

```text
npm run dump -- <path> [<path> ...]
```

The user runs the command and pastes its XML output. Batch requests to reduce round trips,
but never guess or proceed without required exact content. `repomix --compress` remains
available for a genuinely broad repository audit; it is not normal onboarding.

## Work and switch at checkpoints

Both roles begin with `SESSION_STATE.md` and `PLAN.md`. Current files and Git override
stale prose. A checkpoint may sit between todo items or inside a batch and may have a
dirty worktree when:

- every file on disk is syntactically complete;
- completed and remaining substeps are recorded;
- the working set names files needed to resume;
- verification already run and still pending is clear.

Switch roles or workflows whenever those conditions hold. Do not wait for phase closure.
If Chat 2 has already emitted a mega file, either apply it or keep it in
`pending-changes.txt` and state clearly that it is unapplied before switching.

## Reasoning and output discipline

Use the least reasoning that reliably handles the next action:

| Task | Role | DeepThink |
|---|---|---|
| Resume, status, prompt, simple docs | Chat 1 | Off |
| Architecture, broad audit, unclear debugging | Chat 1 | On |
| Decision-complete mechanical implementation | Chat 2 | Off |
| Cross-file planning, migration, sync/auth/schema failure | Chat 2 | On for planning |

At task start and completion, give one short recommendation for the next DeepThink
setting. Do not restate supplied context, narrate routine decisions, enumerate discarded
options, or design for unrequested hypotheticals. Ask only when an answer changes product
behavior, architecture, data/remote schema, an external contract, or destructive safety.

Chat 1 returns a concise decision-complete plan or review. Chat 2 returns the mega file,
then only the apply command, failure instruction, and next DeepThink recommendation.
When Chat 1 emits a documentation-only update, it uses the same full-file format.

## Full-file mega format

Chat 2 emits one fenced block using exactly five tildes and the `mosaic` tag. It contains
only changed full files, optional deletions, the updated workflow-neutral session state as
the final file, and a concise conventional commit message:

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
Directive lines inside ordinary Markdown fences are content; the installer is fence-aware.
The outer opening and closing fence characters and lengths must match.

The user pastes the block into ignored `pending-changes.txt`, then runs:

| Command | Purpose |
|---|---|
| `npm run apply:dry` | Parse and validate without writing |
| `npm run apply` | Back up, write, lint, test, build, then offer to commit |
| `npm run apply:docs` | Apply documentation without runtime verification |
| `npm run apply:start` | Apply, verify, and start the development server |
| `npm run apply:rollback` | Restore the latest `.mosaic-backup` snapshot |

`npm run apply` stages touched paths only. Verification failure leaves written files in
place for inspection; rollback is explicit. Pending content and backups are user-owned
and must not be overwritten by another workflow.

## Return to Codex

Apply or clearly record any pending mega file, then open `life-tracker/` in VS Code and
start with:

```text
You are Codex. Use the Codex workflow and resume from SESSION_STATE.md.
```

Codex reads the workspace directly, checks Git, and continues from the same checkpoint.
