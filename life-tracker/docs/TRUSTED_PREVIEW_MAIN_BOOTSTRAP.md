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

## Shadow readiness: official read-only pilot evidence

As of 2026-10-13, the allowed pilot branch HEAD remains
`62ae49cc4773cfd57a766b587fa877c4e8717c57`. The completed
GitHub push Quality Gate #38318701965 and same-suite canonical acceptance
are SUCCESS. The official Vercel Git deployment
`dpl_CjsoQ5CoU4At7iRWDqPfC3DmxAYX` for that exact branch/SHA is
READY, with Preview target `null`. These independent readbacks prove the
source and candidate exist but **do not** prove that the still-disabled
receiver executed with its eventual restricted Vercel token.

The receiver's bounded project-scoped history scan must prefer a READY
candidate if duplicate in-flight deployments are present for the same
accepted SHA. It must ignore wrong repository/ref/SHA, custom/Production
attempts, missing IDs and failed builds. A matched list result is only a
candidate: the full authenticated deployment GET must still prove project,
source, target, exact commit and READY before proceeding. These regressions
require no deployment API writes and cannot replace the live shadow gate.

## First credentialed shadow result and candidate-list discrepancy (2026-10-13)

The owner enabled an environment-scoped Vercel token on the trusted
`main` receiver, and separately configured repository variables:
`MOSAIC_TRUSTED_PREVIEW_ENABLED=true`,
`MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED=false` and
`MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED=false`. Existing pilot Quality
Gate #38318701965 was rerun (attempt 2), SUCCESS, and triggered the
default-branch receiver #38328093235. GitHub Actions logs prove
trusted `main@1796f6636cd3d22f1b0de1ab9e08b8bacb89cf8d`
checkout and confirmed the intended flags, but failed closed at
`Trusted Preview creation disabled: reuse-only shadow mode`.
No new Vercel deployment or alias mutation was observed.

The authenticated Vercel connector still lists an exact-SHA READY
official Git Preview `dpl_CjsoQ5CoU4At7iRWDqPfC3DmxAYX` for the
approved source branch, and the Vercel project-scoped history scan via
connector includes that candidate after the original commit time.
Thus there is a disagreement between the provider list observed by
the connector and the receiver's runtime candidate selector. The
list endpoint may omit `target` when the connector supplies `null`;
that possibility is **not yet proven**. Tightening LIST selection to
only explicit `null` accidentally risks losing safe candidates.
Allow the absence of `target` only for list-stage candidates, never
for the full authenticated GET which still rejects missing or
Production targets. On a no-match, log small counts (pages, listed
items, matching SHA/ref, absent target) without dumping secrets or
provider payloads so the next live run can diagnose this cleanly.
Do not work around a missing candidate by enabling hosted creation.

The latest main Quality Gate #38326773317 was SUCCESS, but Vercel's
exact-main Git status reported `Deployment rate limited — retry in 24 hours`;
prior Production remains READY on the earlier main commit. Wait for
the quota window and retry via normal Git integration rather than
forcing builds or claiming newer Production READY.

## Second credentialed shadow run — concrete provider shape root cause (2026-10-13)

The accepted pilot Quality Gate #38318701965 was rerun a third time
(success), triggering main-owned Trusted Preview Delivery #38329261073.
The authorized read-only job reported:
`pages=1 listed=18 sameSha=1 exactRef=1 absentTarget=1`, then
failed safely with creation disabled. The main Quality Gate #38329110108
passed and Vercel Production `dpl_6id9FN1ATTmgxANnjD5oHTRwC7JR` is now
READY for exact `main@0e39e7315e18e6750843780432dd42d22f940367`;
the earlier rate-limiting status was temporary.

Vercel's published SDK contract for `GET /v6/deployments` defines
`uid` as the *required* deployment identifier. The connected Vercel
app normalizes it to `id`, and the receiver incorrectly required
`dep.id`, discarding the otherwise matching raw response. The
list-stage selector now permits either `uid` or `id` if they agree
when both exist, preserving the `dpl_` namespace. Only the returned
candidate ID crosses into the strict authenticated full
`GET /v13/deployments/:id` check, which must still prove Git source,
non-production target, exact project, branch, SHA, repo and READY state.

As before, this candidate-stage fix is not live until reviewed and
merged to trusted default `main`. The create and alias toggles must
remain OFF. Use the successful existing pilot's original SHA for
future shadow reruns, not an app or provider deployment POST.

## Reviewed source workflow hash before generalizing automatic Previews

The approved historical pilot `fix/workflow-build-parity-592-20261012@62ae49cc4773cfd57a766b587fa877c4e8717c57`
has immutable Git blob `f8a6588644db34ffa20a7c311c00a030ed88a12b`
at `.github/workflows/quality-gate.yml`. Current trusted main has a
different workflow blob; equality with current main is **not** valid
evidence for the legitimate historical pilot.

A later unreviewed feature branch could change its own Quality Gate
workflow, yet produce checks with the expected name/path and green
canonical-acceptance. Preserve the single reviewed pilot source blob
as an independent requirement in the trusted receiver. Retrieve only
Git Trees metadata from the candidate commit: `.github` tree,
`workflows` tree and final `quality-gate.yml` blob. Reject truncated
or missing entries and unreviewed blob SHAs. Never download candidate
YAML/code or execute candidate artifacts on a token-bearing runner.
Future reviewed source workflow versions need an explicit trusted
allowlist/migration policy before general branch expansion.

This adds no Vercel build or API write. Do not enable creation or alias
flags, disable existing Git automatic Previews or change main/Production.
