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
3. Accumulate the complete user-scoped task: implementation, tests, docs, and checkpoint.
4. Create one task commit.
5. The `Verify` workflow starts automatically for pushes to `chatgpt/**`. Pull requests
   also run it, and `workflow_dispatch` allows a manual rerun.
6. A GitHub-connected chat reads the workflow run, job status, and job logs directly.
7. If verification is green, report the result and continue to any required manual checks.
   If verification is red, diagnose the log and repair the same task without asking the
   user to relay terminal output.

Newer pushes cancel stale runs for the same ref.

## One commit per task

The default history contract is one visible commit per user-scoped task or agreed batch.
Do not make commits for intermediate edits, each file, lint cleanup, documentation updates,
or checkpoint churn. Build the full task first, then commit it once.

Remote CI creates a timing constraint because it can only verify committed repository
state. On an AI-owned disposable task branch, a failed pre-handoff task commit may be
replaced/amended on the same parent so the final visible history still contains one task
commit. Never rewrite user-owned/shared history, and never force-update a branch the user
may have based work on without explicit approval. If safe replacement is unavailable,
surface the exception instead of silently creating a stack of repair commits.

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
