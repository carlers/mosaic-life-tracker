# Remote verification and phone workflow

This workflow is for a chat with direct GitHub repository access and GitHub Actions access,
but no local shell. It lets Mosaic development continue from a phone without requiring the
user to run verification commands or paste terminal logs.

## Single verification workflow

`.github/workflows/verify.yml` remains the only GitHub Actions verification workflow. A
small classifier chooses the least expensive safe mode from the exact changed paths and
commit intent:

- **Docs-only:** ordinary changes limited to project-root Markdown or `life-tracker/docs/**`
  run project-contract/link validation plus `git diff --check`. No application dependency
  install, Vitest, production build, or browser job runs.
- **Focused:** ordinary `chatgpt/**` runtime pushes run `scripts/verify-focused.mjs`
  against the push's real before-SHA (falling back to the previous commit for a new branch).
  Contracts and discovery always run, ESLint receives changed code files, and Vitest uses
  its Git-aware changed-file selection. The lockfile-keyed Node 22 `node_modules` cache
  remains in place. Add `[verify:browser]` only when an intermediate real-browser check is
  specifically needed.
- **Full:** runtime pull requests, manual dispatches, and an exact task commit whose message
  contains `[verify:full]` fan out after classification into independent static/lint,
  unit, handler, DOM, production build/PWA/size, and Playwright jobs. The non-browser jobs
  each use a fresh lockfile-driven `npm ci --prefer-offline --no-audit` with the built-in
  npm download cache; the browser job retains its prepared dependency and Chromium caches.
  A final `canonical-acceptance` job succeeds only when every required parallel job passed.
- **Preview guard:** a `preview` push does not repeat those immutable-SHA tests. It checks
  GitHub's check runs and succeeds only when that exact SHA already has a successful
  `canonical-acceptance` check.

All checkout jobs cap history at two commits; jobs that need an older push base fetch only
that exact commit on demand. Sparse checkout limits the working tree to the workflow/project
paths each job needs. Same-ref concurrency cancellation remains enabled, so a newer push
kills superseded work.

A focused or docs-only green run is never acceptance. The exact final task commit still
requires `[verify:full]` and a green `canonical-acceptance` check before Preview moves.

## Phone-only loop

1. Work on an AI-owned `chatgpt/**` task branch.
2. Inspect the current checkpoint and relevant files through GitHub.
3. Group the task into a small number of meaningful sub-batches.
4. Use no more than 3–5 visible commits for the entire task; small tasks should use fewer.
5. Ordinary runtime pushes receive focused verification; ordinary docs-only pushes receive
   only the lightweight docs gate. Use `[verify:browser]` only for an intermediate
   browser-sensitive checkpoint.
6. When the batch is implementation-complete, make the exact final task commit contain
   `[verify:full]`. That one SHA receives the complete parallel acceptance gate and must
   produce a green `canonical-acceptance` check. Avoid post-green closure commits; put the
   durable session/doc checkpoint into the final commit before running acceptance.
7. Read workflow status/logs directly and repair failures on the same task branch. After
   the exact final task SHA is full-green, fast-forward `preview` to it as part of task
   completion and verify the Vercel deployment. The resulting Preview Verify run is only
   the prior-acceptance guard, not a duplicate full suite.

Newer pushes cancel stale runs for the same ref.

Treat remote verification as an asynchronous gate. Full static, test, build, and browser
jobs fan out so their wall times overlap; the browser job also caches its pinned Chromium
payload between runs. During an active run, finish independent deterministic
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

The verification workflow uses read-only repository contents plus read-only check-run
metadata, Node 22, `npm ci`, and the checked-in lockfile. Ordinary verification does not
require production credentials.
Repository or environment secrets should only be added when a future task explicitly
requires a remote integration check, and those checks should remain separate from normal
offline-capable verification.