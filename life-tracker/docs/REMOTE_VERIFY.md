# Remote verification and phone workflow

This workflow is for a chat with direct GitHub repository access and GitHub Actions access,
but no local shell. It lets Mosaic development continue from a phone without requiring the
user to run verification commands or paste terminal logs.

## Single verification workflow

`.github/workflows/verify.yml` remains the only GitHub Actions verification workflow, but
it has two execution modes to minimize prompt-to-green latency without weakening final
acceptance.

- Pull requests, `preview`, manual dispatches, and a `chatgpt/**` push whose commit
  message contains `[verify:full]` run the canonical gate: fresh `npm ci`, then
  `npm run verify` (contracts, discovery, lint, all Vitest projects, production build),
  with the complete Playwright browser-contract job in parallel.
- Ordinary `chatgpt/**` pushes run `scripts/verify-focused.mjs HEAD^`: contracts and
  discovery always run, ESLint receives only changed source/script files, and Vitest uses
  its Git-aware `--changed` selection. They intentionally skip the production build and
  unrelated test projects. Add `[verify:browser]` to an intermediate commit when the
  browser job is specifically needed.
- A focused green run is never acceptance. The exact final task commit must get a green
  `[verify:full]` run before `preview` can move to it.

The browser job caches a prepared `node_modules` tree keyed by the repository lockfile,
Node version, and exact Playwright/Axe versions, then separately caches Chromium. On a cache
hit it avoids the prior second dependency-resolution/install pass; the canonical verify job
still performs fresh `npm ci`, so final dependency/lockfile verification is unchanged.

## Phone-only loop

1. Work on an AI-owned `chatgpt/**` task branch.
2. Inspect the current checkpoint and relevant files through GitHub.
3. Group the task into a small number of meaningful sub-batches.
4. Use no more than 3–5 visible commits for the entire task; small tasks should use fewer.
5. Each ordinary `chatgpt/**` push receives focused verification. Use
   `[verify:browser]` only for an intermediate browser-sensitive checkpoint.
6. When the batch is implementation-complete, put `[verify:full]` in that exact commit's
   message. That push runs the complete repository and browser acceptance gate. `preview`,
   pull requests, and manual dispatches are always full mode.
7. Read workflow status/logs directly, repair failures on the same task branch, and only
   move `preview` after the exact final task commit is full-green.

Newer pushes cancel stale runs for the same ref.

Treat remote verification as a multi-minute asynchronous gate. The repository and browser
jobs start together so their wall times overlap, and the browser job caches its pinned
Chromium payload between runs. During an active run, finish independent deterministic
review/documentation work before checking status again; do not busy-poll Actions.

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
Vitest discovery validation, ESLint, Vitest, TypeScript/Vite build, service-worker checks,
and build-size guards that are already part of `npm run verify`. The same `Verify` workflow also runs repository-owned
Playwright interaction contracts from `tests/e2e/` in its browser-contract job.

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