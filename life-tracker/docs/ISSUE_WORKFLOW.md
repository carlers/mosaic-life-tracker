# GitHub Issues workflow

GitHub Issues is Mosaic's **development task backlog and plan record**. ChatGPT remains
a supported primary interface for capture, planning, implementation requests, and
handoffs. GitHub Projects is optional, not a prerequisite. This workflow does not
authorize coding, deployment, or promotion merely because an issue exists.

Repository truth stays divided by responsibility: `AGENTS.md` and
[`AI_WORKFLOW.md`](AI_WORKFLOW.md) own execution rules;
[`DELIVERY.md`](DELIVERY.md) owns branch/CI/release gates;
[`PROJECT_REFERENCE.md`](PROJECT_REFERENCE.md) owns architecture and product contracts;
[`PLAN.md`](PLAN.md) summarizes durable roadmap workstreams; and
[`SESSION_STATE.md`](SESSION_STATE.md) owns the currently active implementation handoff.
An issue records **what to do, why, acceptance, and work-specific decisions**. It cannot
override repository safeguards. Do not mirror every issue into the roadmap or checkpoint.

## ChatGPT-first quick capture

Natural requests such as "add to backlog: Escape should act like Android Back",
"make an issue for the chat bubble right-click bug", or "capture these ideas" authorize
**issue creation only**, not research, planning, implementation, or Git changes.

1. Verify access to the actual GitHub repository (`carlers/mosaic-life-tracker` for this
   deployment) and issue write tools. Do not imply connector availability means a write
   succeeded. If unavailable, return a copy-ready minimal issue; do not claim creation.
2. Search **open and closed issues** for obvious duplicates before writing. For an exact
   duplicate, return the existing link and do not create another. For plausible overlaps
   with meaningfully different scope, preserve the difference or ask one focused question
   if impossible to decide. Never silently overwrite someone else's issue description.
3. Capture a short descriptive title and the user's actual request/desired result. Include
   relevant reproduction context or images **only when explicitly intended for publication**.
   Keep unresolved design choices under "Open questions"; do not invent behavior, priority,
   deadlines, acceptance results, dependencies, or versions.
4. Create the smallest useful issue. Suggested initial body:
   `## Intent` (what and why), `## Notes` (supplied context, if any), and
   `## Open questions` (only if necessary). Do not require forms, elaborate templates,
   estimates, or a technical plan at intake. If multiple distinct ideas are clearly
   requested, create separate issues and return a compact set of links.
5. Return the issue number and URL **only after the GitHub tool confirms creation**.
   Do not change local project files merely to capture an idea.

**Public repository warning:** GitHub Issues here are public. Never copy private Mosaic
account contents, credentials, email addresses, private chat content, real user data,
or complete personal-task screenshots without explicit consent to publish. Redact sensitive
details before writing. User-provided ideas are not automatically approved for publishing
other visible personal context. An ambiguous privacy case requires clarification.

Labels are conveniences, not prerequisites. Prefer verified existing labels when useful;
do not assume a particular label exists or that the connected client can create it.
Avoid introducing a large mandatory taxonomy. A missing project board, label-management
API, or automation must never block basic capture.

## Planning and execution

- "Plan issue #N" means fetch that **exact issue**, read current Git and applicable
  contracts, evaluate alternatives/dependencies, and write a concise implementation plan
  and verification/acceptance criteria back to the issue when write access exists.
  **No implementation** until the user authorizes it.
- "Critique #N" means check assumptions, edge cases, safety boundaries, and overlooked
  requirements; revise the issue plan with substantive findings without silently
  changing user-approved scope. A plan written by an agent is not user approval.
- "Go on #N" or "implement #N" after authorization means follow the existing task-branch,
  focused-CI, stable-Preview, deployment, and explicit-promotion process. The issue supplies
  task intent; the repository supplies implementation rules. Do not automatically start
  another issue after finishing one.
- When making changes, retrieve the issue and related PRs, latest applicable checkpoint,
  and **exact branch/SHA**. New chat sessions must not rely on unpersisted previous-chat
  context. Include an issue link in task PR titles/bodies and use `Refs #N` in PR bodies
  when appropriate. Avoid `Fixes #N` / `Closes #N` while work is still awaiting Preview,
  dev, manual, or production acceptance.
- Preserve original user intent and existing issue comments when editing. Add approved
  plan/acceptance and only milestone-level changes; don't replace the issue body wholesale
  with a transient session note, copy entire prompts, or write CI-poll commentary.
  Re-read before edits if there is a risk another writer changed the issue. Use comments
  when supported, or an append-only progress section, and keep the issue navigable.
- If an issue has uncertain scope, confirm only the blocking decision. Do not force
  prioritization or a full specification for a quick captured idea.

## Lifecycle and completion

A **single active implementation task** is the default; independent read-only planning
and review may run alongside it. Do not infer safe parallel implementation just because
issues are distinct: versions, shared Scratch Appwrite, Preview aliases, CI, and merges
have cross-branch dependencies.

An open issue may be an unplanned idea, approved task, or verified Preview awaiting
promotion. Prefer evidence links over rapidly toggling status labels. Update issue plans
at meaningful decisions and link task PR, accepted stable Preview SHA, manual checks,
and deployment evidence as they become available. The GitHub default branch is `main`,
so auto-closing keywords should not be used as a shortcut around Mosaic's gates.

For shipped behavior, close as **completed** only after explicit authorized promotion
to `main` and required production/acceptance checks are confirmed; leave open with a
clear blocker if Preview or dev succeeded but release is pending. For intentionally
Preview-only or non-shipping work, close only after its explicitly documented acceptance
conditions are met; do not claim a production release. Record cancellation as not planned,
and duplicate closure only when the actual duplicate is verified. Issue closure does not
replace PR acceptance, testing, checkpoint updates, or release documentation.

## Retrieval and future Project boards

"What's next?" means search open issues and inspect priorities/dependencies if present;
make a short recommendation grounded in issue content and `PLAN.md`, not an invented
ranking. "Where were we on #N?" means summarize the issue, associated PRs and current
checkpoint, explicitly distinguishing proven checks from unverified or manual work.

A GitHub Projects board may be added if a larger backlog needs roadmap/kanban views.
Its absence is not a blocker, and not all ChatGPT GitHub connections expose Projects
field-management actions. Never claim Project status synchronized unless the actual board
was queried/updated. Start with Issues, measure friction, and add automation only for
a demonstrated repeated manual operation.

## Acceptance of this workflow

Test on an actual issue with authenticated connector actions: create, read back, update
without dropping original content, and retrieve it from a new chat/context. Confirm no
automatic implementation or issue closure. For repo-only documentation changes, run
`npm run contracts:check`, review the diff, and use the existing CI/Preview gates.
Do not mark an unavailable browser, device, or connector test as completed.
