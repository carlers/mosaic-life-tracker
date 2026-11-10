# Mosaic GitHub Project issue intake — issue #1875

An independent default-branch GitHub Actions workflow routes existing GitHub Issues (not PRs) into eight owner-private GitHub Projects by exact area labels. It has no application, backend, MCP or Vercel runtime dependency.

| Repository label | Personal Project | Verified node ID |
|---|---|---|
| area:integrations | [#1 — Integrations & Plugins](https://github.com/users/carlers/projects/1) | PVT_kwHOCQsqas4Bqt23 |
| area:everyday | [#3 — Everyday Experience](https://github.com/users/carlers/projects/3) | PVT_kwHOCQsqas4Bqxbl |
| area:oracle-dr | [#4 — Oracle Migration & Disaster Recovery](https://github.com/users/carlers/projects/4) | PVT_kwHOCQsqas4BqxxV |
| area:release-1.0 | [#5 — 1.0 Readiness](https://github.com/users/carlers/projects/5) | PVT_kwHOCQsqas4BqxxX |
| area:social | [#6 — Social Experience](https://github.com/users/carlers/projects/6) | PVT_kwHOCQsqas4Bq8CC |
| area:storage | [#7 — Storage & Media Lifecycle](https://github.com/users/carlers/projects/7) | PVT_kwHOCQsqas4Bq8CG |
| area:product | [#8 — Product Discovery & Support](https://github.com/users/carlers/projects/8) | PVT_kwHOCQsqas4Bq8CM |
| area:platform | [#9 — Platform & Engineering](https://github.com/users/carlers/projects/9) | PVT_kwHOCQsqas4Bq8CS |

An issue with multiple area labels may appear in multiple Projects. Labels are matched case-insensitively. Generic labels never trigger routing. No issue or its source fields are mutated by the router. Removing an area label does NOT remove a Project item.

## Label bootstrap

When the intake workflow or its routing/label-bootstrap source changes on `main`, a default-branch push job creates only missing labels `area:social`, `area:storage`, `area:product`, and `area:platform`. Existing labels are preserved without metadata rewrites. The bootstrap job has a job-scoped `issues:write` GITHUB_TOKEN permission and no Project token. The issue-routing job remains separately scoped to `issues:read`; its Project token is used only for fixed, owner-private Project GraphQL mutations.

The four original labels already exist and were backfilled before this extension. After the bootstrap job succeeds, the new labels must be backfilled additively onto the existing issues in Projects #6–#9. This triggers the normal issue-event router for open issues and makes future classification consistent. Existing Project memberships remain untouched.

## Security and behavior

- `.github/workflows/issue-project-intake.yml` listens to `issues.opened`, `issues.labeled`, and `issues.reopened`. GitHub executes the issue-event workflow only when it is on the default branch. The label-bootstrap job runs only on a push to `main` that changes the intake workflow or its routing/label-bootstrap source.
- A repository variable, `MOSAIC_PROJECT_INTAKE_ENABLED`, must explicitly equal `true` for issue routing to run. The variable was verified active by the previous real default-branch event acceptance; keep the gate in place.
- The router's built-in `GITHUB_TOKEN` has only `contents:read` and `issues:read`. It re-reads current live issue state and labels and validates the exact source repository/issue identity before attempting a Project write.
- The separate GitHub Actions secret, `MOSAIC_PROJECTS_ROUTING_TOKEN`, provides personal-Project access. Before each write, GraphQL verifies the credential owner `carlers` and that the fixed destination is owned by `carlers`, private and open. The token is never forwarded outside GitHub or printed.
- Only Project mutation is `addProjectV2ItemById`, which is idempotent. It cannot edit Project fields, create/close source issues, remove items, change built-in workflows, approve releases or touch Production. New items keep GitHub's safe default Status = Backlog.
- The bootstrap job is isolated from routing and has `issues:write` only so it can create the four exact fixed repository labels. It does not receive `MOSAIC_PROJECTS_ROUTING_TOKEN`, does not edit issue content/labels, and does not write Projects.
- Missing Project secret on an eligible issue fails visibly; absent labels/unsupported events safely skip. A close/unlabel race between the live read and mutation remains possible; this is not transactional. No automation uses PR-merge status as release authorization.

## Verification and operations

1. Confirm the default-branch push bootstrap job creates or verifies the four new labels.
2. Add the new area labels to the 34 unique existing issues represented by Projects #6–#9, preserving every existing label. #1460 intentionally receives both `area:social` and `area:storage`.
3. Independently read back all 35 memberships and verify the 34 issue-label mappings. For open issues, confirm successful issue-event executions and that the existing Project item is returned idempotently.
4. Create one disposable open issue carrying all four new labels. Verify exactly one item in each of Projects #6–#9, all initially Backlog, and repeat one label event to confirm no duplicate. Remove the four test Project items and close only that disposable issue after readback.
5. Roll back routing by setting `MOSAIC_PROJECT_INTAKE_ENABLED=false` or deleting the variable. The label bootstrap is harmless and idempotent; it creates only the four fixed labels.

## Tests and source delivery

From repository root: `node --test life-tracker/scripts/project-intake/*.test.mjs`. The path-scoped `.github/workflows/issue-project-intake-ci.yml` runs the same tests without credentials. Version impact: NONE (internal GitHub automation). Keep the change tooling-only; use the isolated main-only rollout path already approved for #1875. Do not promote the divergent `dev` tree or alter application/backend/version/Production state.

References: [GitHub Actions Project automation](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/automating-projects-using-actions); [idempotent addProjectV2ItemById](https://docs.github.com/en/issues/planning-and-tracking-with-projects/automating-your-project/using-the-api-to-manage-projects); [default-branch issue events](https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#issues).
