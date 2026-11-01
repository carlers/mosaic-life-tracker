# Natural-language bulk commands — design proposal (#1441)

**Status:** B0 delivered; B1 guarded owner-only bulk move UI implemented as v0.55.0 Preview candidate. B2/B3, external MCP and production promotion remain outstanding. Single-task create remains explicitly confirmed.

## Goal and semantics

Support commands such as:
- `Move all unfinished tasks from School to Backlogs`: scope the **signed-in owner's** active School tasks with completed=false and date nonempty; set date to the unscheduled Backlogs value (`''`) while keeping categoryId=School, title, and completion unchanged; adopt the existing default privacy policy for unscheduled tasks.
- `Move all tasks from School to Projects`: retain each task's original scheduled date, replace only categoryId after resolving an existing owner category. Ask if the user actually wants date or category changed when destination resembles a date or special page.
- `Move all tasks from School to Projects for tomorrow`: preview the combined category and date update, never infer one silently.
- `Complete my overdue tasks in School`: account-local tasks with completed=false and date strictly before the device-local current date, excluding Backlogs; set completedAt consistently.
- `Move the 3 oldest uncompleted tasks from Work to Backlogs`: sort by stable timestamp/id, show the exact three; "oldest" may mean createdAt, scheduled date, or order, so force clarification unless explicit.
- `Delete all tasks in School`: separate destructive tier, soft deletion only with high-friction confirmation and reversible history.

## Command parsing (read-only first)

1. Extend intent model with typed discriminated union: `create_task`, `bulk_move`, `bulk_complete`, `bulk_reschedule`, `bulk_soft_delete`, `search`, `needs_review`, `unsupported`. Parser returns **filters**, requested updates, ambiguity diagnostics and confidence; NEVER calls RxDB, Appwrite, or Actions.
2. Parse source category and destination separately with case-insensitive exact matching of the **owner's live category IDs**. Recognize Backlogs as unscheduled **date**, not a category. Do not match category names embedded in task titles. Explicitly distinguish `all tasks`, `all uncompleted tasks`, and `tasks for a specified date`; "all" never silently crosses account, friend, date, or visibility boundaries.
3. Relative dates use device local calendar interpretation at proposal time; show absolute dates before confirmation. If source or destination, completion state, task count, visibility, or scheduling semantics is uncertain, request edits or clarification.
4. Out-of-scope actions (payments, accounts, diaries, friends, messages, other owners' tasks, category deletion) remain unsupported. Voice and text produce the **same reviewable transcript** and parser output; no speech transcript invokes a mutation.

## Selection and confirmation UX

- The user edits filters and destinations in a Mosaic sheet. List exact matching tasks, full title/date/category/completion/visibility, total count, affected categories and days, and a before→after summary. Include search, expand, and deselect/individual exclusions; preview is read-only.
- Empty match -> no action. 1 match still requires confirmation. Large matches -> paginated details, explicit count and cap (proposed **100 tasks per confirmation**, lower for expensive operations); no hidden background continuation.
- For high-impact actions show a second confirmation with operation/quantity, and typed confirmation for mass soft-deletion. Require repeatable approval for each batch. Do not silently auto-create categories in bulk flows.
- Show partial outcomes: successful, skipped, conflicted, failed, with an itemized retry of **only** failures. Never declare the whole batch successful if any write failed. No automatic retry of task-changing operations after ambiguous network outcomes.

## Execution, isolation and undo

1. Add a command-specific executor using the **existing RxDB hooks and sync design**, not a direct client-side privileged Appwrite API. Query only `userId === currentOwner`, `isDeleted=false` tasks and live current-owner categories. Do not accept IDs from the parser without independent query validation.
2. Freeze a proposal snapshot: owner ID; filter parameters; sorted matching task IDs; preimages for the fields to be changed; each task's `updatedAt`; desired updates. At confirm, **re-read and revalidate every item**, including active account, source/date/category, membership, current state, and destination, before writing. Changed items become conflicts and require a new preview.
3. Use a **bounded and cancelable write queue** with per-task success/failure, not unconstrained `Promise.all`. `runBulkTaskActions` currently uses `Promise.allSettled` and returns failed IDs; extend its behavior for bounded concurrency, explicit progress and auditable results rather than assuming a transaction.
4. Provide an **owner-scoped local undo journal** containing before/after field values, transaction ID and applied item IDs, lasting long enough for a useful Undo snackbar / history view. Compensation must check that the task's current post-state still matches the command's write before reverting; otherwise refuse unsafe rollback and display conflicts. A journal persisted offline must not leak across accounts or rehydrate incorrectly. Hard deletion is excluded.
5. Preserve fields not explicitly requested (attachments, titles, reminders, routine links, createdAt) and established date/category ordering semantics; resolve batch ordering deterministically, avoid collisions/overflow. Moving to Backlogs should follow existing unscheduled privacy expectations rather than accidentally exposing tasks.
6. Multi-tab and multi-device sync convergence: no shared-server lock assumed. The preview snapshot is optimistic, and the executor must survive offline, partial writes, tab changes, reload, and sync conflicts without applying a batch to another user's tasks. No false atomicity promise.
7. Prefer a **small first batch** to validate ordering, sync and undo with actual devices before wider operations or destruction.

## Phased sequence

- **B0 — Parser and preview only:** typed intent/filter AST, source/destination disambiguation, frozen match list, empty/ambiguous handling, zero writes; synthetic and human-authored adversarial test corpus.
- **B1 — Safe bulk move:** e.g. School→Backlogs, then category-to-category/date moves. Confirm and bounded writes; owner ID validation, partial-result report, undo.
- **B2 — Bulk completion/rescheduling:** date windows, completedAt and reminder/routine semantics, conflicts and undo.
- **B3 — Soft deletion and complex operations:** explicit second confirmation, careful restore / retention behavior, high-volume limits, real device/storage testing. Bulk across friend accounts or production-affecting admin operations remain unsupported.

## Required testing and promotion boundaries

Unit tests: lower-case categories, overlapping category names in titles, owner-switch, malicious/untrusted transcript, all-vs-current-day, backlogs vs category, mixed completed/unfinished, none/many/too many results, duplicate IDs, deleted categories and stale documents, repeated confirmation and rapid double-click, offline/reload, concurrent tabs, partial failure and retry, undo after unrelated edits, follower/public visibility, routine/reminder and sync convergence. Browser tests: sheet focus, virtualized long previews, mobile accessibility, Android Back, voice transcript correction. Never weaken the existing CI/Appwrite/Production gates.

**B0 shows read-only matches for narrowly parsed bulk moves, but execution remains disabled.** Implementation requires an explicit follow-up authorization and a new Preview candidate. No dev/main/Production promotion without separate approval.


## B1 core preparation (2026-11-02)

An isolated, **unwired and non-executable-from-UI** pure bulk-move coordinator now provides bounded owner-scoped optimistic validation, serialized compare-and-patch calls, observable per-item conflict/partial failure outcomes, Backlogs privacy and conflict-checked compensation. It cannot itself mutate RxDB or Appwrite: the eventual adapter is required to compare all reviewed owner/task fields atomically at write time. This is *not B1 user-visible release acceptance*: source-wide sync completeness, ordering, durable account-scoped undo and explicit UI confirmation still need implementation and device verification. Bulk writes remain disabled.


## B1 guarded bulk move candidate (2026-11-02)

The lazy Home command sheet now supports owner-only bulk move confirmations. The user selects at most 20 reviewed changed tasks, with no preselection if over 20 matched, and types MOVE N. A completed full-app Sync Now within five minutes and online connectivity are required; the domain hook re-queries owner task scopes before applying sequential RxDB incrementalModify operations with per-task owner/state/version checks within the atomic modifier. Backlogs moves enforce privacy. Partial failures, conflicts and cancel remaining are reported. Owner-scoped sessionStorage holds an expiring 15-minute undo receipt with conflict-aware comparison and reload recovery. Cross-device atomicity and absence of network races are not guaranteed. Physical-device sync/undo acceptance and B2/B3/MCP remain outstanding.
