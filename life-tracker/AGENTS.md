# AGENTS.md — Mosaic

These instructions apply to AI work in `life-tracker/`. Treat this directory as the
project root for editor context, commands, paths, and documentation. The Git repository
remains one directory above it.

## Workflow selector

Select by capability, not provider:

- A **workspace agent** can inspect/edit this repository, run commands, and use Git. Use
  `docs/CODEX_WORKFLOW.md`; Codex local/IDE and Codex Cloud are current examples.
- A **web chat** has no assumed repository or shell access. Use
  `docs/WEB_CHAT_WORKFLOW.md` with the Planner/Reviewer or Implementer role.
- An explicit user instruction selects the workflow and role. Otherwise, a Codex session
  with repository tools defaults to the workspace-agent workflow. Provider and model names
  never change architecture, safety, output, or verification rules.
- `PLAN.md`, `SESSION_STATE.md`, Git, and current files are shared truth. Switch at any safe
  checkpoint, including mid-task or mid-batch. Git transports exact files across separate
  workspaces; packets transport context to web chat; complete `mosaic` bundles return web
  chat changes to a workspace.

## Migration footer

- End every final user-facing response with exactly one migration line containing one
  runnable command: `Migration: npm run handoff -- <target>`.
- Codex targets `deepseek-chat1` when the next action needs planning, review, audit, or
  unresolved decisions. It targets `deepseek-chat2` when the next action is already a
  decision-complete implementation or fix.
- DeepSeek Chat 1 and Chat 2 target `codex`. If a DeepSeek response contains a mega file,
  write `Migration after apply: npm run handoff -- codex` instead.
- Keep the migration line as the last textual line. When a native approval prompt must
  end the interaction, place the migration line immediately before that prompt.
- Before recommending migration after meaningful work, make `SESSION_STATE.md` an honest
  checkpoint. The command prepares a handoff; it never changes workflows automatically.

## Start here

- Read `SESSION_STATE.md` for the current handoff and `PLAN.md` for the roadmap.
- Read only the relevant sections of `docs/PROJECT_REFERENCE.md` before changing a
  documented product or architecture contract.
- Inspect the current implementation and `git status` before editing. Existing user
  changes must be preserved.
- Use current code as source of truth when progress prose is stale. Correct documentation
  in the same batch when the discrepancy is material.

## Task complexity and model guidance

At task start, say `Task profile: <profile> — <one-sentence reason>.` At completion, say
`Next-task profile: <profile> — <one-sentence reason>.` Profiles are Routine, Standard,
Complex, and Exceptional.

The model column below is optional guidance only when the active surface exposes controls.
Codex Cloud may assign model and reasoning without user controls; continue with that active
configuration, never ask the user to select an unavailable setting, and never claim prompt
text changed the model. Complexity always informs planning depth, batch size, and checks.

| Task | Profile | Optional configuration |
|---|---|---|
| Mechanical edits and simple documentation | Routine | GPT-5.6 Sol · Low |
| Scoped features, ordinary fixes, tests | Standard | GPT-5.6 Sol · Medium |
| Defined cross-file refactors and migrations | Complex | GPT-5.6 Sol · High |
| Architecture, broad audits, unclear debugging | Complex | GPT-6 Astra · High |
| Difficult sync/auth races and migration design | Exceptional | GPT-6 Astra · Extra High |

## Rolling handoff

Every turn-ending response is a recovery boundary and ends with a token-efficient
`**Run:**` telemetry line followed by a `**Handoff:**` footer. Initialize and update the
local ledger with `npm run metrics -- ...` when the surface has workspace access; never
invent unavailable token or cache values. The detailed contract and commands are in
`docs/WORKFLOW_TELEMETRY.md`. When telemetry is not initialized and state is unchanged use:

`**Run:** task=<id> · telemetry=off`
`**Handoff:** Agent: resume from SESSION_STATE.md + Git · Chat: npm run handoff -- chat-plan`

After material work, use at most three short lines naming the checkpoint, agent resume, and
`chat-plan` or `chat-implement`. Full prompts belong in generated handoffs. Before replying,
finish or unwind the current atomic operation, leave complete files, and update
`SESSION_STATE.md` when task state, decisions, working files, or verification changed.

The user instructions `Prepare an agent handoff`, `Prepare a planning-chat handoff`, and
`Prepare an implementation-chat handoff` authorize that checkpoint only. Stop new work,
run the smallest useful check, produce the correct Git or packet transport, and stop. A new
workspace/cloud task needs a pushed branch/commit; never call local-only edits portable.
Recovery is guaranteed from the last completed response, not a later turn interrupted
before it could write or checkpoint.

## Working agreement

- Default to one agent. Use subagents only when the user explicitly requests delegation
  or the task has clearly independent workstreams and the environment authorizes it.
- When the user says "proceed" or "continue", follow the most recent concrete
  recommendation without asking them to approve it again. This authorizes that
  scoped next step, not every remaining roadmap batch or an unmentioned external action.
- Default to thorough verification and the safer implementation. Resolve related
  issues within the agreed scope instead of creating avoidable follow-up backlog.
  Favor speed or reduced scope only when the user explicitly asks to ship quickly.
- Once a batch is agreed, inspect, edit, run proportionate checks, fix failures,
  review the diff, and update project state without waiting between routine steps.
- Stop after the agreed batch. Do not begin the next roadmap batch, commit, push,
  deploy, publish, or change a remote service unless the user authorized it.
- Ask only when a choice materially changes product behavior, architecture, data or
  remote schemas, external contracts, or destructive outcomes. Resolve ordinary
  naming, placement, and pattern choices from the repository.
- Workspace agents edit files directly. Web-chat Implementers use the full-file `mosaic`
  installer described in `docs/WEB_CHAT_WORKFLOW.md`.
- Keep components cohesive rather than enforcing arbitrary line limits. Split files
  when it improves ownership, reuse, testing, or readability.
- Update `SESSION_STATE.md` at meaningful checkpoints and handoffs, including its
  working set and completed/remaining substeps. Do not store commit status or the active
  workflow there; derive commit state from Git and workflow role from the user prompt.
  Update `PLAN.md` only after the corresponding work is verified.
- After all required checks pass, recommend one concise conventional commit message.
  When the active surface can present native approval buttons for the concrete Git command,
  use that approval prompt as commit confirmation. Otherwise ask the text fallback:
  `Commit these changes with "<message>"? (yes/no)`. Ask only after the result is ready
  to commit. If the user already authorized the commit in the current request, do not
  ask again; make the commit after verification.
- Stage only paths changed for the agreed task, never `git add -A`. Preserve unrelated
  worktree changes. After committing, report the commit hash and subject.

## Definition of done

Run checks from this directory. Choose the smallest sufficient set, then broaden when
risk or failures justify it:

- Documentation-only: check links/references, `git diff --check`, and inspect the diff.
- Focused logic or component change: run the relevant test file during iteration, then
  its `test:unit`, `test:handlers`, or `test:dom` project; broaden when shared paths changed.
- Cross-cutting/runtime batch: `npm run lint`, `npm test`, and `npm run build`.
- Appwrite function or schema change: add/update handler, mapping, migration, and
  regression coverage as applicable; document any required Console operation.

Before the acceptance gate, run a test-evidence review. List the batch's behavioral
changes and map each to `existing-direct`, `existing-indirect`, `added-red-green`,
`manual`, `skipped`, or `not-applicable` evidence as defined in
`docs/TEST_WORKFLOW.md`. New regression tests cite the governing `AGENTS.md` heading,
project-reference section, or task acceptance ID. Capture behavioral red→green evidence
during development; use the isolated `npm run test:red` fallback only when it is safe and
useful. A structural red is labeled separately, and unrelated failures are never evidence.
The evidence check validates report completeness but does not decide adequacy. If code
changes after this review, update it before rerunning the acceptance gate.

Every completion report states what changed, automated checks and results, material risks
or manual checks, commit/PR status when applicable, and the next-task
complexity profile. Include a short manual verification protocol for user-visible behavior.
It also includes exactly one factual test-evidence paragraph with coverage-status counts,
red classifications, focused/acceptance results, and manual/skipped reasons, ending:
`No judgment of overall suite sufficiency is made here.`

## Non-negotiable data and sync rules

- UI components consume domain data and actions through hooks. Do not import `rxdb`,
  `rxjs`, or raw Appwrite services into UI components, and never expose Observables to UI.
- Raw `TablesDB`, `Storage`, `Functions`, and `Account` construction belongs only in
  `src/lib/sdk.ts` and `src/lib/appwrite.ts`. Use the guarded SDK surface elsewhere.
- Database files may be changed when an agreed task requires it. Schema changes must
  include versioning and migrations, sync mapping and known-field updates, mirrored
  test-database migrations, remote schema steps, and regression tests as applicable.
- RxDB uses `isDeleted`; Appwrite uses `deleted`. Deletes are tombstones
  (`isDeleted: true`), never hard deletes.
- Appwrite row IDs are at most 36 characters, match `[a-zA-Z0-9_]+`, and do not start
  with `_`. Use the established deterministic hash helpers when composite IDs exceed it.
- Existing remote rows use `updateRow`; new rows use `createRow`. A 404 fallback from
  update uses `createRow`, never `upsertRow`, because Appwrite 2.0 upsert has replacement
  semantics.
- Cross-user writes go through the `message-action` Appwrite Function. Client code
  never writes another user's row directly.
- Outgoing message `read_at` is server-owned and must be omitted from client pushes.
- Preserve local-dirty-wins sync behavior, pull overlap, bounded loops, pagination,
  collection isolation, and Web Lock coordination unless the task explicitly revisits
  those contracts.
- A confirmed 401 means unauthenticated. Network failure or timeout means session state
  could not be checked. Preserve cached offline identity and never collapse those states.

## React and application architecture

- `AuthProvider` is the sole session-state owner. `useAuth` is a consumer; do not add
  independent `account.get()` calls. Depend on `user?.$id`, not the user object.
- User-scoped hooks track the loaded user ID and expose no previous user's data during
  an account transition. Mutators use stable callbacks and report failures through the
  established UI patterns.
- One provider owns each shared collection subscription. Preserve the provider order:
  `FriendsProvider` above `ConversationsProvider`.
- Keep local/remote serialization in `src/lib/syncMapping.ts`; do not map fields ad hoc.
- Keep auth errors in `src/lib/authEvents.ts` and raw SDK guards in `src/lib/sdk.ts`.
- Preserve cancellation, re-entrancy, stale-revision, optimistic-revert, and bounded
  retry protections documented in `docs/PROJECT_REFERENCE.md` §§9–10 and 18–23.
- This is a client-side Vite SPA. Do not add `"use client"` or SSR assumptions.

## UI rules

- Reuse established components and interaction patterns. For genuinely new UX with no
  applicable product spec or repository precedent, obtain a product decision before coding.
- All modals and slide-ups use the shared `BottomSheet`; destructive confirmations use
  the shared confirmation sheet. Do not create fixed-position sheet implementations.
- Keep the dark, mobile-first Tailwind design. Apply data-driven colors with inline style
  values rather than generated Tailwind class strings.
- Handle hook loading and error states. Use existing spinner, error-banner, feedback,
  and toast patterns.
- Icon-only buttons need action-oriented `aria-label`s. Interactive elements use semantic
  controls, keyboard focus remains visible, and labels are associated with inputs.
- Preserve gesture priority, scroll-lock ownership, portal layering, focus handling,
  and reserved layout space for conditionally visible status UI.
- Visibility values are `public`, `followers`, and `private`. Selected followers remain
  backlog scope unless explicitly approved.

## Product state

The app currently includes auth, account/settings, task actions, categories, calendar,
friend discovery/calendars, direct messaging, replies, message/task reactions, offline
support, and sync/error hardening. Notifications remains a Coming Soon route. Todo List
and Diary views remain backlog work. `PLAN.md` is authoritative for sequencing.

## Reference map

- `docs/PROJECT_REFERENCE.md` — detailed numbered product and architecture contracts,
  accepted limitations, test patterns, and historical decisions.
- `docs/CODEX_WORKFLOW.md` — direct-workspace workflow for local and cloud agents.
- `docs/WORKFLOW_TELEMETRY.md` — local task, verification-loop, cadence, and usage metrics.
- `docs/WEB_CHAT_WORKFLOW.md` — provider-neutral packet and installer workflow.
- `PLAN.md` — durable roadmap and completion status.
- `SESSION_STATE.md` — concise current handoff.

When comments refer to `§N`, they point to the matching numbered section in
`docs/PROJECT_REFERENCE.md`.
