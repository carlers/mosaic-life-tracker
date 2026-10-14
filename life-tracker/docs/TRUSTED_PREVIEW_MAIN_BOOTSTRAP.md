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

## Proposed read-only prebuilt shadow activation (#592, October 14, 2026)

This main-based infrastructure candidate replaces the old Git-source receiver
workflow with a **read-only** `workflow_run` handler restricted to the single
accepted stable canary branch. It copies only audited Node builtin-based
artifact verification support, no frontend app changes. A successful completed
canonical Quality Gate and correct source SHA/run attempt must precede any
ZIP download. All six artifact members, GitHub SHA256 digest, bounded tar, 161
file inventory, Scratch/GIPHY/PostHog feature profile, two blocking closure
budgets and exact reviewed Vercel v3 rewrites/headers are verified. The source
head and canonical check suite are re-read after the download.

There is **no Vercel deployment token, secret environment, CLI build, POST,
alias update, hosted deployment or credential** in this candidate. Even if old
repository creation/alias variables remain enabled, the receiver forces them
both OFF and refuses actual provider writes. Normal Vercel Git Preview creation
continues independently; the new handler cannot fix quota until a separately
reviewed cutover adds the protected provider writer, idempotent policy and a
red/green/stale/rollback canary.

The main branch still contains application v0.17.4, while dev contains v0.23.4.
Staging this targeted workflow must not promote feature code to Production.
The protected-main preflight intentionally rejects source branches other than
`dev`; any infrastructure-only exception requires **new explicit owner approval**
for this exact PR, narrow temporary PR-only bypass, immediate restoration and
main canonical/Production verification. Prior exceptions do not transfer.

## Provider-side one-commit idempotency spike (2026-10-14)

The first live main-owned read-only shadow, [#38506275297](https://github.com/carlers/mosaic-life-tracker/actions/runs/38506275297), succeeded for a genuine canonical-green canary source SHA `56ceb5af2beef4e1c248a52d5395517306294cb2`. It read 161 verified build files and made zero Vercel POSTs. One existing Git-created Preview remains: automatic Git creation has **not** been replaced.

The proposed trusted provider writer may use **Vercel Build Output API `config.json.deploymentId`**. The ID is deterministically computed from official project, canary branch and accepted source SHA, independent of workflow-run retries. Vercel documents a unique-per-project, <=32-character custom deployment ID and failure on duplicate IDs. This is an additional backstop, not permission to skip complete GitHub/provider history and freshest source acceptance. The reviewed main receiver must prove original route bytes/hash before inserting just this immutable field; no candidate may select its own deployment ID. First test on a bounded Preview-only canary; do not assume it works for Vite without actual provider evidence.

Use pinned `vercel@62.7.0`, installed *without Vercel credentials* before the trusted deploy step, and CLI `deploy --prebuilt --target=preview --archive=tgz` against the verified artifact. Do not invoke `vercel build`, `npm ci`, candidate source scripts or package install with privileged tokens. Associate sha/branch/run/attempt and deterministic ID using CLI `--meta` for future bounded, fail-closed duplicate scans. Require protected token only in main-controlled writer job with creation and alias default OFF and fresh canonical readbacks.

Vercel `git.deploymentEnabled` currently contains `fix/*: true`. Per Vercel Git configuration, **any matching true wins**, so adding an explicit exact-canary false will not avoid pre-CI Git creation. Do not turn off `fix/*` before a working automatic replacement + rollback. Measure red provider creations only after the branch class has actually cut over. Keep `dev` and `main` Git auto targeting intact for the initial rollout.

No protected main, provider setting, credential or Vercel deployment has been changed by this planning spike. The next infrastructure-only provider writer requires fresh owner-reviewed protection exception; PR #807 permission does not carry forward.

## Root cause of failed #592 canary Git suppression — 2026-10-14

Two real Git deployments were created for `fix/592-trusted-archive-20261014`
after changing broad `fix/*: true` to an excluding extglob, including one
with a failed canonical CI run. The **likely mechanism is now reproduced**
using standard minimatch behavior: `*: false` matches only one path segment,
so it does not match any `fix/...` branch; the excluding extglob also does not
match this canary. With no matching rule, Vercel defaults Git deployment to
`true`. A local Node 24 glob regression demonstrates the exact old behavior
and the corrected explicit rule. This also explains why `chatgpt/*: false`
successfully suppresses all quiet task pushes.

A newly reviewed candidate variant retains the non-overlapping
`fix/!(592-trusted-archive-20261014): true`, **adds exact literal**
`fix/592-trusted-archive-20261014: false`, and preserves all existing
`main`/`dev`/other category rules. Any overlapping `fix/*: true` remains
forbidden because Vercel says a matching true overrides false. The protected
writer's allowed SHA-256 config digest and preflight checks now require that
literal negative rule; the previous unsuccessful variant is rejected.

**This is a contract-level explanation, not yet live provider acceptance.**
The protected writer is still OFF and the canary currently uses the rolled-back
known-good `fix/*: true`. Stage this main-based validator separately, verify
focused/full CI, and obtain normal owner review for protected-main infrastructure
promotion before considering another single bounded live canary. Do not turn on
provider POST or alias until there is actual evidence of zero Git creations on
a red push, then one accepted prebuilt upload on green and safe rollback.

## Live prebuilt writer first failure — 2026-10-14

The corrected exact canary=false Git matcher is independently proven: two full
canonical-green pushes created ZERO Git deployments, and accepted
`fix/592-trusted-archive-20261014@7df6dd4` had **red** canonical gate
[#38522051059](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522051059)
with ZERO deployments. The existing logout/auth PostHog DOM test timed out
under a parallel shard; a test-only 5s wait repair was squash-merged in
[PR #820](https://github.com/carlers/mosaic-life-tracker/pull/820).
Its new stable commit `bf56a5f84bf985370c34368f1ce0d2161d2925ec`
passed full [Quality Gate #38522610668](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522610668).
The main-owned read-only verifier succeeded, and the protected writer actually
started in [Trusted Preview Delivery #38522774415](https://github.com/carlers/mosaic-life-tracker/actions/runs/38522774415), proving the owner's
`MOSAIC_TRUSTED_PREVIEW_CREATE_ENABLED` variable is enabled, alias remains OFF.
**The provider writer FAILED before any POST/hosted deployment:** official
Vercel CLI v62.7.0 responded `User not found (404)` when passed the numeric
`team_UbpudOr8jXyrDA5SdVUxVGOr` to `--scope`. Vercel's current official
CLI global-options contract uses `--scope <team-slug>` and instead permits
`--team <team-id>`. In-code authenticated Vercel project and history GETs
succeeded before the CLI invocation, so credentials/project preflight is good;
project-scoped deployment history for `bf56a5f` remains EMPTY.

This infrastructure-only patch changes `--scope team_ID` to `--team team_ID`
and adds an explicit regression. No app/provider/branch config, alias, token or
CI policy change. This code cannot affect the protected writer until separately
promoted through a **NEW owner-approved, temporary main PR-only bypass**.
Do not rerun the failed provider job with the old main code or push another
canary while this patch is unmerged; a new accepted canary SHA can prove the
corrected CLI path after main CI/Production v0.17.4 and rule restoration.
