# ChatGPT GitHub Connector Workflow

## Purpose

Document the repository workflow used when ChatGPT has GitHub connector access during an engineering session.

## Commit communication rule

When reporting completed repository work, report the commit message, not the commit hash. Hashes may be retained internally for traceability but are not the primary handoff identifier.

## Execution flow

1. Read the current session state and relevant project documentation before making changes.
2. Inspect the current branch, verification state, and affected files.
3. Make the smallest scoped implementation change needed for the task.
4. Add or update regression coverage when behavior changes.
5. Run the repository verification gates.
6. Fix failures from the actual failing layer rather than bypassing checks.
7. Commit with a descriptive conventional-style commit message.
8. Update the preview/review branch only after verification passes.
9. Record completed work, verification evidence, remaining manual checks, and the next action in the session documentation.
10. Hand off using the commit message and verification summary.

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

No check is marked complete without its actual result.

## Handoff format

The final handoff should contain:

- completed work;
- verification results;
- remaining manual acceptance items;
- the commit message used for the completed change.

Commit hashes are not the user-facing identifier for completed workflow handoffs.
