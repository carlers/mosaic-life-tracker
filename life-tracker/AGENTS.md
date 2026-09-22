# AGENTS.md — Mosaic

These instructions apply to AI work in `life-tracker/`. Treat this directory as the
project root for editor context, commands, paths, and documentation. The Git repository
remains one directory above it.

## Workflow selector

Select by capability, not provider:

- A **workspace agent** can inspect/edit this repository, run commands, and use Git. Use
  `docs/CODEX_WORKFLOW.md`; Codex local/IDE and Codex Cloud are current examples.
- A **GitHub-connected chat** can inspect/edit the repository through GitHub and inspect
  GitHub Actions, but has no local shell. Use `docs/REMOTE_VERIFY.md`; GitHub Actions is
  its remote execution environment for `npm run verify`.
- A **web chat without repository access** uses `docs/WEB_CHAT_WORKFLOW.md` with the
  Planner/Reviewer or Implementer role.
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
- Workspace agents target `chat-plan` when the next action needs planning, review, audit,
  or unresolved decisions. They target `chat-implement` when the next action is already a
  decision-complete implementation or fix.
- Web chats target `agent`. If a web-chat response contains a mega file, write
  `Migration after apply: npm run handoff -- agent` instead.
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

At task start, say `Task profile: <profile> — <difficulty>/10 · ETA <time> — <one-sentence reason>.`
At completion, say `Next-task profile: <profile> — <difficulty>/10 · ETA <time> — <one-sentence reason>.`
Profiles are Routine, Standard, Complex, and Exceptional. Difficulty is an integer from 1–10.
ETA is a best-effort wall-clock estimate that includes likely remote-tool/CI wait time; update
it when new evidence materially changes the estimate rather than pretending the original ETA
is still accurate.

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
- **Commit cap per task:** use at most 3–5 visible commits for each user-scoped task or
  agreed batch. Each commit must represent a meaningful sub-batch (for example:
  implementation, regression coverage, or verified documentation/checkpoint), not an
  individual file, lint cleanup, commentary, or state-file churn. Prefer fewer commits
  when the task is small. Remote verification may run after each meaningful sub-batch;
  repair the current sub-batch before starting another. Never rewrite user-owned/shared
  history without explicit approval.
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

## Remote verification

- `.github/workflows/verify.yml` is the single shared remote verification workflow for
  `preview`, AI-owned `chatgpt/**` branches, pull requests, and manual dispatches. Its
  `verify` job installs with `npm ci` and runs the same `npm run verify` command used
  locally; its dependent `browser-contract` job runs the repository-owned Playwright
  contracts in `tests/e2e/` after the canonical gate is green.
- When the active chat has GitHub Actions access, inspect workflow status, jobs, and logs
  directly instead of asking the user to run terminal commands or paste verify output.
- Treat remote verification as asynchronous work, not a reason to busy-poll. While CI or a
  deployment is running, do any independent deterministic review/documentation work first;
  otherwise wait for a meaningful interval before the next status check. Fetch detailed job
  logs only after a failure, an unusual stall, or when step-level state is needed to choose
  the next action. Avoid repeated near-identical status calls that waste time and tokens.
- GitHub Actions does not replace browser/device/remote-service checks that are explicitly
  manual. Record those separately.
- Local `npm run verify` copies its output to the clipboard; CI skips clipboard handling
  and keeps the streamed output in the Actions log.
- Hosted phone/browser review uses the deployment-only `preview` branch and
  `docs/PREVIEW_DEPLOYMENT.md`. Move `preview` only to an exact green verified commit
  and only when deployment/browser review is user-authorized. The preview branch is never
  a merge or source-development branch.

## Definition of done

Run checks from this directory. Choose the smallest sufficient set, then broaden when
risk or failures justify it:

- Documentation-only: run `npm run contracts:check`, check `git diff --check`, and inspect the diff.
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
  (`isDeleted: true`) during the sync-retention window. Permanent deletion is allowed only
  through the synchronization-safe tombstone GC described in `docs/TOMBSTONE_RETENTION.md`.
  The default retention window is 90 days; clients whose per-collection cursor is older than
  that window perform a full pull before treating missing remote rows as absent.
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

- **UI preservation rule:** unless the agreed task explicitly requests a visual or interaction-design change, treat the existing UI as an acceptance constraint. Preserve layout, typography, colors, spacing, sizing, positioning, responsive behavior, visible controls, interaction chrome, and established visual hierarchy. Do not opportunistically restyle, simplify, modernize, rename, move, hide, or replace adjacent UI while fixing unrelated behavior.
- **Accessibility does not silently restyle Mosaic:** accessibility fixes should prefer semantics, keyboard behavior, focus handling, labels, announcements, and other non-visual mechanisms. Do not change the palette, contrast treatment, typography, spacing, sizing, or overall visual look for accessibility work unless the user explicitly approves that visual change. If a requirement appears to conflict with the established aesthetic, record the issue and ask for a product decision instead of recoloring or redesigning by default.
- Keep UI diffs scoped to the requested surface. Refactors and bug fixes must preserve existing rendered appearance and interaction affordances unless a visual change is necessary to satisfy the stated task or an existing documented product contract. When a broader visual change would be required, surface that as a product decision instead of silently expanding scope.
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

The table in `README.md` is the contributor-facing contract index. The map below is the compact agent lookup. `npm run contracts:check` verifies these authoritative entry points and their local Markdown links remain discoverable.

- `docs/PROJECT_REFERENCE.md` — detailed numbered product and architecture contracts,
  accepted limitations, test patterns, and historical decisions.
- `docs/CODEX_WORKFLOW.md` — direct-workspace workflow for local and cloud agents.
- `docs/REMOTE_VERIFY.md` — GitHub-connected chat workflow and remote verification loop.
- `docs/PREVIEW_DEPLOYMENT.md` — stable hosted phone/browser preview workflow.
- `docs/ACCESSIBILITY_AUDIT.md` — current Phase 4 WCAG review findings and manual evidence protocol.
- `docs/WORKFLOW_TELEMETRY.md` — local task, verification-loop, cadence, and usage metrics.
- `docs/WEB_CHAT_WORKFLOW.md` — provider-neutral packet and installer workflow.
- `PLAN.md` — durable roadmap and completion status.
- `SESSION_STATE.md` — concise current handoff.

When comments refer to `§N`, they point to the matching numbered section in
`docs/PROJECT_REFERENCE.md`.