# ChatGPT GitHub Connector Workflow

## Purpose

Document the repository workflow used when ChatGPT has GitHub connector access during an engineering session.

## Commit communication rule

When reporting completed repository work, report the commit message, not the commit hash. Hashes may be retained internally for traceability but are not the primary handoff identifier.

## Single-output execution rule

When the user authorizes a task with “go”, “continue”, or equivalent approval, treat that
task as one user-facing execution cycle. The ETA covers the whole cycle through implementation,
commit(s), required GitHub Actions results, failure repair, preview movement when applicable,
and deployment status when applicable.

Do not send progress updates or stop merely because CI is queued, in progress, or has failed.
Wait for the workflow to reach a terminal result. If it fails, inspect the actual failing
job/logs, fix the issue, commit the repair, and repeat until the required gate is green.

Return before green only when a concrete blocker cannot be resolved with the available
connector/tool access. If that happens, report the exact blocker and why execution cannot
continue. “CI has not started yet”, “CI is still running”, or “CI failed” are not blockers
by themselves.

## Execution flow

1. Read the current session state and relevant project documentation before making changes.
2. Inspect the current branch, verification state, and affected files.
3. Make the smallest scoped implementation change needed for the task.
4. Add or update regression coverage when behavior changes.
5. Run the repository verification gates.
6. Fix failures from the actual failing layer rather than bypassing checks.
7. Commit with a descriptive conventional-style commit message.
8. Wait for required GitHub Actions to finish; repair failures and rerun until green.
9. Update the preview/review branch only after verification passes.
10. Wait for deployment status when deployment is part of the task.
11. Record completed work, verification evidence, remaining manual checks, and the next action in the session documentation.
12. Hand off once, using the commit message and final verification summary.

## Verification order

Preferred order:

- targeted tests for the changed behavior;
- lint/type checks;
- full repository verification command;
- browser/device contracts where applicable;
- deployment status where applicable.

## Failure handling

Failures are treated as evidence from the failing layer:

- lint failures are fixed in source or test structure;
- unit failures are addressed with the regression contract in mind;
- browser failures are reproduced with the relevant interaction model;
- deployment failures are verified against the deployment output.

No check is marked complete without its actual result. A failed check is an input to the
repair loop, not a reason to hand control back to the user.

## Handoff format

The final handoff should contain:

- completed work;
- verification results;
- remaining manual acceptance items;
- the commit message used for the completed change.

Commit hashes are not the user-facing identifier for completed workflow handoffs.
