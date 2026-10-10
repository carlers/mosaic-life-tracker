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

## Natural-language cross-chat resume

A request like **"pick up where we left off on the shared tasks issue"**,
**"continue the sticker work"**, or **"where were we on backlog?"** is a
repository-backed resume request, including from a brand-new ChatGPT conversation.
The user need not supply the original chat, a handoff prompt, a branch, or an issue
number. Follow this procedure before resuming work:

1. **Resolve the intended issue.** Search the connected
   `carlers/mosaic-life-tracker` GitHub repository's open **and closed** issues
   by distinctive title/topic terms and issue references. Include variants and
   established aliases (e.g. "shared tasks" ↔ "Explore shared tasks with
   friends"). Prefer an explicit number or unambiguous title match, not the
   newest global checkpoint or most recently updated unrelated issue. If
   multiple plausible issues remain, present the matches and ask which one;
   never silently pick a task to mutate.
2. **Recover the issue's latest durable state.** Read the full issue
   (including its end), its most recent **Resume checkpoint** comment if any,
   related open/merged/closed PRs and their target branches, and task/stable
   Preview branch heads. The newest issue checkpoint is an *index* to verify,
   not authoritative proof that work deployed. Read the global
   `docs/SESSION_STATE.md` only as additional context when its task matches;
   a different active task must not override the requested issue.
3. **Reconcile actual work.** Verify exact branch/SHA, PR merges, Actions
   results for that SHA, Vercel deployment when relevant, and backend readiness
   separately. Check `dev`/`main` before claiming promotion. If the prior
   chat stalled after a GitHub write, merge, workflow dispatch, or cloud
   operation, **check whether it already succeeded before retrying**. If
   checkpoint text conflicts with live evidence, prefer the live evidence and
   repair the checkpoint at the next meaningful milestone.
4. **Continue safely.** Identify the last verified milestone, outstanding
   blockers, and **next permitted action**. "Pick up" or "continue" can carry
   forward the user's existing authorization to implement or fix an active
   task; it cannot invent authorization to implement a planning-only issue,
   run a security-sensitive migration, or promote to `dev`/`main`. An
   explicit approval gate still requires approval. If the issue only asked
   for status, report status rather than acting. If connected repository
   access is missing, state the exact access blocker instead of guessing.
5. **Minimize interruption.** Do not require the user to re-explain the
   task or copy an old-chat summary when the above evidence is available.
   Work through approved steps with the normal [AI](AI_WORKFLOW.md) and
   [delivery](DELIVERY.md) workflow; distinguish automated, hosted,
   browser/device and manual evidence. Preserve account and Scratch/Production
   boundaries.

### Durable per-issue resume checkpoint

At a **meaningful milestone** (approved design; coherent verified task
commit; stable Preview CI/ready deployment; backend acceptance; failed gate
with diagnosed blocker; approved promotion; or genuine handoff), add a **short
issue comment** headed `## Resume checkpoint`. This is the stable entry point
for later conversations, independent of any one branch's session file.
Prefer a new milestone comment to repeatedly replacing the issue's long
plan or copying chat transcripts. Do not comment on every CI poll or write
post-green status-only commits.

Include only what a new reader needs:

- **Task/status:** issue number and stage (planning, task branch, Preview,
  blocked, dev, main); relevant authorization and any outstanding approval.
- **Exact refs:** active task branch/PR if relevant; accepted stable Preview
  branch and SHA, with evidence links; dev/main status if a promotion is in scope.
- **Verified:** exact-SHA tests, CI, deployment and backend evidence; explicitly
  identify what has *not* been tested, especially real login/device acceptance.
- **Next safe action:** one concrete next step, prerequisites and blocker if any.

Keep the comment compact, factual, and safe for this **public** repository;
never expose credentials, real-user account contents or private prompts.
A latest checkpoint from a failed or incomplete agent operation must not be
mistaken for completion. Later agents must re-check the GitHub facts it cites.

**Cold-start acceptance:** In a fresh chat in this Mosaic project with
working GitHub access, the phrase "pick up where we left off on the shared
tasks issue" must resolve to #406, inspect its most recent checkpoint,
verify the stable `feature/shared-tasks` SHA, PR/Actions/Preview evidence,
and identify outstanding Scratch/manual gates **without requiring the old
chat or implementing/promotion without approval**. Also evaluate ambiguous
matches, unavailable GitHub access and stale checkpoints. A same-chat
connector dry run is useful but is **not** proof of actual fresh-chat/device
acceptance.

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
