# Trusted Preview receiver: main bootstrap review (#592)

Status: **Infrastructure-only bootstrap merged to main via #772 on 2026-10-13; receiver remains OFF.**
Source reviewed on the #592 stable Preview branch and promoted to `dev`
by [PR #769](https://github.com/carlers/mosaic-life-tracker/pull/769).

## Why a separate main candidate exists

GitHub runs `workflow_run` listeners only from the repository default
branch (`main`). The staged trusted receiver lives on `dev` but
cannot execute there. As of this checkpoint `main` still has application
version 0.17.4 while `dev` has 0.23.4 and extensive unreleased app
work, so merging all of `dev` into `main` solely to bootstrap this
workflow would cause an unrelated Production release.

The reviewed bootstrap candidate was built on the previous `main` tree and
copies **only** the trusted receiver workflow, pure support scripts
and focused tests; it does not change the application, Appwrite,
app version, size budgets, Vercel project configuration or any
credentials. The owner approved a narrow Option B direct-main exception for PR #772 only. The
merge did not ship dev application features, change version 0.17.4, or enable
receiver credentials. Main Quality Gate #38321997796 and Vercel Production
were READY/SUCCESS for merge `033e85ce8e78ef109dc15866a971ee0a0dba4b7c`;
GitHub ruleset #24880070 was restored with no bypass actors.

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
  A third independent `MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED` switch is
  required to permit **any** hosted GitSource POST. Keep it OFF for reuse-only
  shadow acceptance and until the provider's target/quota behavior is proven.
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

## Reuse-only shadow safety refinement (2026-10-13)

The initial main bootstrap receiver could create a hosted GitSource deployment
whenever Vercel's normal Git deployment was temporarily absent. Vercel's REST
`target` default is not a sufficient Production safety boundary across project
settings, so enabling an unrestricted write token before a controlled target
pilot was unsafe. The proposed follow-up adds a separate default-OFF creation
switch and fails closed if no exact existing candidate is found. Hosted POST
responses must carry `target: null`; only those exact known Preview targets
may proceed, and full READY/SHA/project/source readback still applies. This
**does not prove** that a future POST cannot be incorrectly classified before
it returns; do not enable creation until a separately reviewed target-safe
pilot and deployment budget contract have passed. The Git-triggered Preview
remains active throughout.

The first shadow acceptance should grant API read/reuse only, keep the alias
switch OFF, and verify the existing official Git-hosted READY deployment;
it must perform zero Vercel POST requests. The bootstrap on main is not
modified by a task/stable Preview-only safety candidate until separately
promoted through an authorized main boundary.

## Further trust-boundary requirements before a token is enabled

The credential-bearing default-branch workflow must use reviewed immutable
GitHub Action versions (including `setup-node`), not a mutable major tag.
In addition to validating the workflow-run SHA and branch HEAD, the receiver
must query `main` and refuse a stale trusted checkout if main advanced while
the workflow was queued. Same-SHA older local CLI canaries are not equivalent
to Git-hosted branch Preview and must not be reused; only `source=git` and
the exact target branch ref are acceptable in shadow readback. These are
pure acceptance checks and do not cause a deployment or alias reassignment.

**Vercel safety evidence:** Vercel's API describes omitted `target` as Preview,
but a 2026 Vercel CLI/API bug report documents projects producing Production
from an omitted target. Therefore the separately gated GitSource POST path
must remain **disabled** until independently proven against this project and
its exact Preview/Scratch configuration. Enabling reuse-only shadow does not
constitute permission to enable creation or disable ordinary Git Previews.
