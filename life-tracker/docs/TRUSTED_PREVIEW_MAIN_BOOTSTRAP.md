# Trusted Preview receiver: main bootstrap review (#592)

Status: **DRAFT REVIEW ONLY — not deployed, not enabled, and not authorized to bypass release gates.**
Source reviewed on the #592 stable Preview branch and promoted to `dev`
by [PR #769](https://github.com/carlers/mosaic-life-tracker/pull/769).

## Why a separate main candidate exists

GitHub runs `workflow_run` listeners only from the repository default
branch (`main`). The staged trusted receiver lives on `dev` but
cannot execute there. As of this checkpoint `main` still has application
version 0.17.4 while `dev` has 0.23.4 and extensive unreleased app
work, so merging all of `dev` into `main` solely to bootstrap this
workflow would cause an unrelated Production release.

This review candidate is built on the current `main` tree and
copies **only** the trusted receiver workflow, pure support scripts
and focused tests; it does not change the application, Appwrite,
app version, size budgets, Vercel project configuration or any
credentials. Preparing a draft main PR is not a production release.
**Do not merge as a direct-main exception unless the owner separately
approves an exception to Mosaic's normal dev→main promotion contract**
and reviewers verify the resulting main canonical/Production effects.

## Trust contract

- GitHub `workflow_run` event must be completed successful `push`
  Quality Gate for the exact SHA on the single approved Preview
  branch, within the official repository and same check suite.
  Re-fetch the latest canonical evidence and branch HEAD. Fail
  closed on incomplete/queued/failed/stale checks.
- Receiver code is checked out from the trusted default branch
  and uses Node built-ins and GitHub/Vercel APIs only.
  It must never download/execute source code or artifacts from the
  triggering Preview branch in the Vercel-token-bearing runner.
- Reuse exact-SHA official Vercel deployment when possible;
  otherwise verify linked project Git repository/monorepo root
  and production branch before a Vercel-hosted Git-source build.
  Recheck READY, project, SHA, source and non-production target.
- Two separate default-OFF repository variables control
  `MOSAIC_TRUSTED_PREVIEW_ENABLED` (shadow delivery) and
  `MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED` (stable alias switch).
  Shadow mode must not redirect the existing Git-triggered URL.
- The `mosaic-preview-auto` secret environment must be provisioned
  only after code trust review. Keep existing reviewer-protected
  `mosaic-preview-canary` untouched. Never put tokens in chat.

## Before enabling

1. Obtain explicit approval for a narrowly scoped main-only
   infrastructure exception **or** wait for the next approved,
   fully accepted `dev→main` release. Existing promotion preflight
   is authoritative; do not bypass it without approved process.
2. Inspect actual Vercel project `link.repoId`,
   `link.productionBranch` and `rootDirectory` from the
   authenticated API; this connector currently does not expose
   those fields, so the receiver's fail-closed preflight is
   deliberately unproven live.
3. Provision the trusted branch/environment/secret with explicit
   one-time owner review. Activate shadow only. Prove exact
   Git-source SHA, Scratch target, READY, metadata, idempotency,
   CI-red/stale-sha exclusion and API quota behavior. No mandatory
   per-commit GitHub approval.
4. Only after full shadow acceptance permit stable alias
   handoff and readback. Leave Vercel Git Preview auto-delivery
   on until CI-gated replacement proves safe. Never use this
   pilot to change `dev`, Production, Appwrite or release gates.

For the broader history and test evidence see GitHub issue #592,
`docs/BUILD_PARITY_DIAGNOSTICS.md` on dev, and the current
`quality-gate.yml` on the accepted stable Preview branch.

## Main-based Preview regression checkpoint

The first full run on the nine-file production-based Preview candidate
([Quality Gate #38320367274](https://github.com/carlers/mosaic-life-tracker/actions/runs/38320367274))
exposed a test-only assumption: dev has a retired branch-level
automatic pilot, but production v0.17.4 never contained it.
The trusted receiver test now accepts the unsafe pilot being absent,
while still requiring an unconditional false guard if the pilot exists.
The fix must pass focused CI followed by a fresh full stable
Preview gate. Do not bypass that verification, and keep the
new main exception PR draft until all relevant gates pass.
