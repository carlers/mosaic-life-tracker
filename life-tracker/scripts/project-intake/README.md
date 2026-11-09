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

- `.github/workflows/issue-project-intake.yml` listens to `issues.opened`, `issues.labeled`, and `issues.reopened`; GitHub executes this event workflow only when it is on the default branch (`main`). It is not triggered by pull requests, comments, issue closure, or label deletion.
- The fail-closed repository variable `MOSAIC_PROJECT_INTAKE_ENABLED` must equal `true`. It is currently enabled and its value was proven by a real default-branch event run on 2026-11-09; do not infer activation from the variable's presence alone.
- Built-in `GITHUB_TOKEN` has only `contents:read` and `issues:read`. The router re-reads current live state and labels and validates the exact source repository/issue identity before attempting a write. An event payload alone is not trusted.
- The separate GitHub Actions secret `MOSAIC_PROJECTS_ROUTING_TOKEN` provides personal-Project access. Before any write, GraphQL verifies the credential owner `carlers` and that the fixed Project destination is owned by `carlers`, private and not closed. The token is never forwarded outside GitHub or printed.
- The only mutation is `addProjectV2ItemById`, documented as idempotent (returns the existing item ID on replay). It cannot edit Project Status/fields, create/close source issues, remove items, change built-in workflows, approve releases or touch Production. Per-issue concurrency reduces races.
- Missing secret on an eligible issue fails visibly; absent labels/unsupported events safely skip. A close/unlabel race between the live read and the mutation remains possible; this is not a transactional system. No automation uses PR-merge status as release authorization.
- The four exact `area:*` labels exist. All four destination Projects are private. The release-conflicting built-in `Auto-close issue`, `Item closed`, and `Pull request merged` workflows were independently verified disabled across the four Projects.

## Activation and live acceptance — verified 2026-11-09

The router is active on the default branch. The accepted tooling-only main promotion is [PR #1887](https://github.com/carlers/mosaic-life-tracker/pull/1887); the verified main SHA is `ec9aae54e095a70581a9f86d79bd64c992ee83a7`. The workflow and its fail-closed variable gate are present on that branch.

Live event acceptance used disposable issue [#1893](https://github.com/carlers/mosaic-life-tracker/issues/1893), labeled with all four area labels:

- Default-branch workflow runs [#42646260645](https://github.com/carlers/mosaic-life-tracker/actions/runs/42646260645) and [#42646263006](https://github.com/carlers/mosaic-life-tracker/actions/runs/42646263006) both succeeded. Their route-step logs independently reported Projects `[1,3,4,5]`.
- Independent private-Project readback found exactly one item in each destination, initially at `Backlog`. Replaying the event created no duplicates and did not close or mutate the source issue. Because the guarded job executed, this also verifies `MOSAIC_PROJECT_INTAKE_ENABLED == 'true'` and availability of the routing secret at runtime.
- All four temporary Project items were removed and disposable issue #1893 was closed with reason `not_planned`. Final readback confirmed the issue was absent from all four Projects and item counts returned to their pre-test values.
- The four area labels were backfilled across existing Project items. The real default-branch workflow completed 74/74 label-event executions successfully during the backfill, with no failures or cancellations. Project readbacks found no missing area labels, duplicate items, or missing Work type values.
- All four Projects have Board, All Issues, Issue Hierarchy, and Blocked views. No Roadmap view was created because no agreed dates or iterations justified one.

The issue-intake activation gate is complete. Keep [#1875](https://github.com/carlers/mosaic-life-tracker/issues/1875) open for the broader adoption gaps below; do not repeat the activation setup or claim those remaining items are complete.

## Remaining GitHub Projects adoption gaps

1. **Native parent/sub-issue links:** the connected Project MCP exposes item fields and views but no GitHub sub-issue relationship mutation. Issue Hierarchy views exist, but meaningful parent/child links have not been invented or written. Audit candidate relationships and use a supported API/tool before applying them.
2. **Project descriptions/metadata:** the connected MCP has no update-project-description operation; the four Project descriptions remain empty.
3. **Temporary Project #2:** `Mosaic — Admin MCP Validation (Temporary)` was read back as empty. The connected MCP exposes no project archive/delete operation, so it remains untouched.
4. **Workflow synchronization:** area-label intake is live and verified. Delivery-stage advancement remains a human/agent evidence-based operation; no automation derives Preview/Dev/Production from PR, CI and deployment evidence.
5. **Fresh-chat operating validation and reusable template:** the boards are populated and standard views exist, but the full ChatGPT-first create → route → resume → verified delivery-status workflow and reusable Project template have not yet been accepted end to end.

## Tests and source delivery

From repository root: `node --test life-tracker/scripts/project-intake/*.test.mjs`. The path-scoped `.github/workflows/issue-project-intake-ci.yml` runs the same tests without a PAT. Version impact: NONE (internal GitHub automation). Follow a chatgpt task branch, focused CI, squash to stable Preview and full canonical CI. Changes to the live default-branch router still require the normal explicit source-delivery approval and gates.

References: [GitHub Actions Project automation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions); [idempotent addProjectV2ItemById](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects); [default-branch issue events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues).
