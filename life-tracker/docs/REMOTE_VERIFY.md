# Remote verification and phone workflow

This workflow is for a chat with direct GitHub repository access and GitHub Actions access,
but no local shell. It lets Mosaic development continue from a phone without requiring the
user to run verification commands or paste terminal logs.

## Single verification source

`npm run verify` remains the only verification definition. GitHub Actions does not
reimplement lint, test, build, or contract rules. `.github/workflows/verify.yml` checks out
the task branch, runs `npm ci`, then runs `npm run verify` from `life-tracker/`.

Local runs stream output and copy the complete run to the clipboard. GitHub Actions sets
`CI=true`, so clipboard handling is skipped and the same streamed output remains in the
job log.

## Phone-only loop

1. Work on an AI-owned `chatgpt/**` task branch.
2. Inspect the current checkpoint and relevant files through GitHub.
3. Group the task into a small number of meaningful sub-batches.
4. Use no more than 3–5 visible commits for the entire task; small tasks should use fewer.
5. The `Verify` workflow starts automatically for pushes to `chatgpt/**`. Pull requests
   also run it, and `workflow_dispatch` allows a manual rerun.
6. A GitHub-connected chat reads the workflow run, job status, and job logs directly.
7. If verification is green, report the result and continue to any required manual checks.
   If verification is red, diagnose the log and repair the same task without asking the
   user to relay terminal output.

Newer pushes cancel stale runs for the same ref.

## Commit discipline

A user-scoped task or agreed batch may use at most 3–5 visible commits. Each commit must
represent a coherent sub-batch that is useful in the history on its own, such as a focused
implementation slice, its regression coverage, or a verified documentation/checkpoint
update. Do not create commits for individual files, tiny cleanup steps, lint fixes,
commentary, or state-file churn. Small tasks should use fewer than three when appropriate.

Remote CI can verify each meaningful sub-batch after it lands. If a sub-batch fails, fix
that sub-batch before starting the next one rather than stacking unrelated repair commits.
Never rewrite user-owned/shared history or force-update a branch the user may have based
work on without explicit approval.

## Interaction/device verification additions

Remote verification must be supplemented with device checks for behaviors owned by the
browser or operating system.

Required manual checks after interaction changes:

- Android/Samsung Back behavior:
  - nested bottom sheets close from the top layer downward
  - route navigation resumes only after sheets are closed
  - final Back behavior is verified on the hosted Preview build
- Nested carousel gesture ownership:
  - calendar swipe changes the calendar view only
  - friend/profile carousel swipe changes friends only
  - pointer ownership changes must not disable the child carousel

These checks cannot be fully replaced by DOM tests because OS history handling and touch
recognition are browser/device behaviors.

## What remote verification can and cannot replace

GitHub Actions can replace local execution of the repository gate: project-contract checks,
ESLint, Vitest, TypeScript/Vite build, service-worker checks, and build-size guards that are
already part of `npm run verify`.

It does not replace checks that genuinely need a browser, device, deployment, authenticated
third-party service, or visual judgment. Examples include touch/gesture feel, installed-PWA
behavior, screenshot/visual review, and live PostHog dashboard validation. Record those as
manual evidence with an exact protocol.

## Workflow security and cost

The verification workflow uses read-only repository contents, Node 22, `npm ci`, and the
checked-in lockfile. Ordinary verification does not require production credentials.
Repository or environment secrets should only be added when a future task explicitly
requires a remote integration check, and those checks should remain separate from normal
offline-capable verification.