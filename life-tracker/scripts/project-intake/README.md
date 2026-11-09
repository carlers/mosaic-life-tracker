# Mosaic GitHub Project issue intake — issue #1875

An independent GitHub Actions workflow routes existing GitHub Issues (not PRs) into four owner-private GitHub Projects by exact issue labels. It has no application, backend, MCP or Vercel runtime dependency.

| Repository label | Personal Project | Verified node ID |
|---|---|---|
| area:integrations | [#1 — Integrations & Plugins](https://github.com/users/carlers/projects/1) | PVT_kwHOCQsqas4Bqt23 |
| area:everyday | [#3 — Everyday Experience](https://github.com/users/carlers/projects/3) | PVT_kwHOCQsqas4Bqxbl |
| area:oracle-dr | [#4 — Oracle Migration & Disaster Recovery](https://github.com/users/carlers/projects/4) | PVT_kwHOCQsqas4BqxxV |
| area:release-1.0 | [#5 — 1.0 Readiness](https://github.com/users/carlers/projects/5) | PVT_kwHOCQsqas4BqxxX |

An issue with multiple area labels may appear in multiple Projects. Generic labels never trigger routing. Labels are matched case-insensitively. No issue or its source fields are mutated. Removing a label does NOT remove the Project item.

## Security and behavior

- .github/workflows/issue-project-intake.yml listens to issues.opened, issues.labeled, issues.reopened, but GitHub executes this event workflow only when it is on the default branch (main). Never triggered by pull requests, comments, issue closure, or label deletion.
- A repository variable, MOSAIC_PROJECT_INTAKE_ENABLED, must explicitly equal true for the job to run; it is absent/off by default. A token without the variable cannot activate anything.
- Built-in GITHUB_TOKEN has only contents:read and issues:read. It re-reads current live state and labels and validates the exact source repository/issue identity before attempting a write. An event alone is not trusted.
- A separate GitHub Actions secret, MOSAIC_PROJECTS_ROUTING_TOKEN, provides personal-Project access. Before any write, GraphQL verifies the credential owner carlers and that the fixed Project destination is owned by carlers, private and not closed. It never forwards a token outside GitHub or prints it.
- Only mutation is addProjectV2ItemById, documented as idempotent (returns the existing item ID on replay). It cannot edit Project Status/fields, create/close source issues, remove items, change built-in workflows, approve releases or touch Production. Per-issue concurrency reduces races.
- Missing secret on an eligible issue fails visibly; absent labels/unsupported events safely skip. A close/unlabel race between the live read and the mutation remains possible; this is not a transactional system. No automation uses PR-merge status as release authorization.

## Owner activation gates (not yet approved)

1. On private [Projects #4](https://github.com/users/carlers/projects/4) and [#5](https://github.com/users/carlers/projects/5), disable built-in Auto-close issue, Item closed and Pull request merged in GitHub UI, then verify via the Admin MCP. Projects #1 and #3 were already verified with those three off.
2. Create the four exact area labels above if absent under the [repository labels](https://github.com/carlers/mosaic-life-tracker/labels). Avoid broad pre-1.0, priority labels or all-open routing.
3. Create a dedicated, short-lived classic PAT for user carlers with GitHub project scope. GitHub says repo scope is additionally required when source repositories are private (the current Mosaic repo is public). Avoid unrelated scopes. Never paste tokens into chat, code, issues or Vercel.
4. Add the PAT only in repository Settings → Secrets and variables → Actions → Repository secrets as MOSAIC_PROJECTS_ROUTING_TOKEN. The existing Vercel Admin MCP OAuth secret is separate; do not reuse it.
5. After accepted stable Preview checks, explicit approval and required gated promotion to dev and main, verify the runtime workflow/script on default branch. Merely merging to Preview/Dev cannot activate it.
6. Under repository Settings → Secrets and variables → Actions → Variables, set MOSAIC_PROJECT_INTAKE_ENABLED=true. This is the final activation switch. Rollback: change it to false or delete it; revoke/rotate the PAT as needed.
7. Validate with a disposable labeled issue and independent Project readback: correct private board, one item, initial Backlog (not Done), no closed source issue. Exercise a second label, repeated event, unknown label, removing/reapplying label, and reopening. Clean up safely. Do not close #1875 until real activated behavior is accepted.

## Tests and source delivery

From repository root: node --test life-tracker/scripts/project-intake/*.test.mjs. The path-scoped .github/workflows/issue-project-intake-ci.yml runs the same tests without a PAT. Version impact: NONE (internal GitHub automation). Follow a chatgpt task branch, focused CI, squash to stable Preview and full canonical CI. No default-branch release without the owner's separate approval.

References: [GitHub Actions Project automation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions); [idempotent addProjectV2ItemById](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects); [default-branch issue events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues).
