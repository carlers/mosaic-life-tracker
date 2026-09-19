# AGENTS.md — Mosaic

These instructions apply when Codex works in `life-tracker/`. Treat this directory
as the project root for editor context, commands, paths, and documentation. The Git
repository remains one directory above it.

## Start here

- Read `SESSION_STATE.md` for the current handoff and `PLAN.md` for the roadmap.
- Read only the relevant sections of `docs/PROJECT_REFERENCE.md` before changing a
  documented product or architecture contract.
- Inspect the current implementation and `git status` before editing. Existing user
  changes must be preserved.
- Use the current code as the source of truth when a progress note is stale. Correct
  the documentation in the same batch when the discrepancy is material.

## Model and reasoning recommendation

At the start of every task, briefly tell the user:
`Recommended for this task: <model> · <effort> — <one-sentence reason>.`

At completion, tell the user:
`For <next task>, select <model> · <effort> before your next prompt.`

These are advisory recommendations. Continue authorized work with the active model
unless the user intervenes, and never claim that text instructions changed the model
or reasoning setting. Use the choices available in the Codex extension. Reserve Max
for exceptional problems where depth matters more than speed and usage.

| Task | Model | Reasoning |
|---|---|---|
| Mechanical edits and simple documentation | GPT-5.6 Sol | Light / Low |
| Scoped features, ordinary fixes, tests | GPT-5.6 Sol | Medium |
| Defined cross-file refactors and this migration | GPT-5.6 Sol | High |
| Architecture, broad audits, unclear debugging | GPT-6 Astra | High |
| Difficult sync/auth races and migration design | GPT-6 Astra | Extra High |

Default to one agent. Use subagents only when the user explicitly requests delegation
or the task has clearly independent workstreams and the active environment authorizes
it. Do not change the user's personal Codex configuration.

## Working agreement

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
- Edit files directly. The repomix/dump/mega-file installer is an optional legacy
  fallback described in `docs/LEGACY_WORKFLOW.md`; it is never required for normal
  Codex work.
- Keep components cohesive rather than enforcing arbitrary line limits. Split files
  when it improves ownership, reuse, testing, or readability.
- Update `SESSION_STATE.md` at meaningful checkpoints and handoffs. Update `PLAN.md`
  only after the corresponding work is verified.
- After all required checks pass, recommend one concise conventional commit message and
  ask one easy question: `Commit these changes with "<message>"? (yes/no)`. Ask only
  after the result is ready to commit. If the user already authorized the commit in the
  current request, do not ask again; make the commit after verification.
- Stage only paths changed for the agreed task, never `git add -A`. Preserve unrelated
  worktree changes. After committing, report the commit hash and subject.

## Definition of done

Run checks from this directory. Choose the smallest sufficient set, then broaden when
risk or failures justify it:

- Documentation-only: check links/references, `git diff --check`, and inspect the diff.
- Focused logic or component change: run the relevant Vitest project or test file,
  then lint and build when shared types or production paths changed.
- Cross-cutting/runtime batch: `npm run lint`, `npm test`, and `npm run build`.
- Appwrite function or schema change: add/update handler, mapping, migration, and
  regression coverage as applicable; document any required Console operation.

Every completion report states what changed, automated checks and results, commit status,
material risks or manual checks, and the recommended next model/effort. Include a short
manual verification protocol for user-visible behavior.

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
- `docs/CODEX_WORKFLOW.md` — how to run a Codex batch in VS Code.
- `docs/LEGACY_WORKFLOW.md` — optional retained repomix and installer tooling.
- `PLAN.md` — durable roadmap and completion status.
- `SESSION_STATE.md` — concise current handoff.

When comments refer to `§N`, they point to the matching numbered section in
`docs/PROJECT_REFERENCE.md`.
