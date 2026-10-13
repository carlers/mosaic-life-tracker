# GitHub CI / Vercel build parity diagnostics (#592)

This is a read-only diagnostic, **not** a replacement for canonical CI or a delivery gate.
Exact source-tree equality does not imply the same Vite bundle when effective build
features, Node version, build-time defines or Vercel environment variables differ.

## Observed incident (2026-10-12)

The following are **same-commit**, full GitHub `canonical-acceptance` green / hosted
Vercel size-guard red pairs. Values are hosted minus GitHub:

| SHA | GitHub run | Vercel ID | entry raw | entry gzip | initial gzip | Home gzip | assets raw | assets gzip | precache |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| `e418b9fc` | 38253738347 | `dpl_T5hZfVAMooPGTKMjKAVP92xg51JW` | +164 | +98 | +98 | +140 | +2214 | +1002 | +2214 |
| `10e8e0e9` | 38250639343 | `dpl_DKxAZudNPXE7wB96LVBHHgc9B4w9` | +164 | +98 | +98 | +140 | +2214 | +1003 | +2214 |
| `5d049204` | 38251884539 | `dpl_AoSnuyCFaM23GqHQueTYUCPmHDE8` | +164 | +97 | +97 | +139 | +2214 | +998 | +2214 |

Vercel logs report **GIPHY enabled**, via a shared Preview-scoped Vercel variable;
GitHub's build has no corresponding configured GIPHY key. Vercel's project Node
version was **24.x**, while the previous GitHub build job used **22.x**. These are
two independently evidenced build-context differences. The repeated 2,214-byte
aggregate delta is consistent with different bundled feature code, but without
controlled builds and file hashes do **not** assert that GIPHY explains every byte.

## Inspect comparable logs without exposing environment secrets

Download **the build job logs** for exact GitHub SHA and matching Vercel deployment
to local temporary files (do not commit, upload or paste unredacted logs).
Run from `life-tracker/`:

```bash
node scripts/compare-build-logs.mjs /tmp/ci.log /tmp/vercel.log \
  <40-character-ci-sha> <40-character-deployment-sha>
```

The command extracts only seven measured bytes, the *presence* of GIPHY from
the explicit build-feature line, major Node version, and Vite version. It does
not display or store API key values or raw JavaScript. Nonzero means mismatch
or incomplete evidence. Older GitHub logs have no feature/runtime banner;
their status will be `unverified` if metrics happen to agree. This is deliberate.

CI build runtime should match the Vercel project Node 24.x. The build process
emits sanitized `[Mosaic] Build features` and `[Mosaic] Build runtime` lines on
official hosted builds and GitHub Actions. A matching size report is **not**
proof of identical artifacts; compare generated JS/CSS by stable Vite manifest
keys and hashes under controlled builds, *never by hashed filename alone*.

## Required before gating Vercel on CI (#592 next phase)

1. Rebuild pinned incident commits in a controlled matrix of Node 22/24 and
   GIPHY absent/present, while preserving Scratch-only Preview backend identity,
   and identify exactly which chunks account for the 2,214-byte difference.
2. Make canonical CI verify the **effective Vercel Preview build** under a
   trusted secret-scoped workflow; a public fake GIPHY key proves *structural*
   attribution only, not exact production-key byte parity. Never expose tokens,
   decrypted Vercel API response data, or bundled secret-bearing artifacts.
3. Check whole-tree/effective-config SHA, required canonical checks, and deployed
   branch aliases; a green build sub-job alone is insufficient if tests fail.
4. Canary a CI-green exact-SHA Preview under the existing automatic-deployment
   policy before disabling *any* stable branch auto deployment. Test stale SHA,
   CI failure, missing credential, wrong Scratch target and idempotent retries.
5. Never disable `dev`/`main` auto deployment or change Production/Appwrite
   as part of this diagnostic. Do not weaken seven size budgets until repeatable
   effective hosted build measurements establish appropriate release limits.

References: [Delivery](DELIVERY.md), [AI workflow](AI_WORKFLOW.md),
[issue #592](https://github.com/carlers/mosaic-life-tracker/issues/592).

## Automated safety checks implemented on the #592 Preview branch

`node scripts/check-build-asset-fingerprint.mjs` runs in `npm run build` on both
GitHub and Vercel, after PWA verification and before the size guard. It reports
one SHA-256 digest for **all emitted JS/CSS**, grouped by Vite's stable manifest
keys (including unmapped emitted assets). The digest excludes the transient
hashed filename, does not display bundled API keys or source code, and is safe
to compare in separate provider build logs. It is **not** a fingerprint of
`index.html`, the service worker, or every non-JS/CSS resource.

If the full build outputs are available securely in separate working directories:

```bash
node scripts/check-build-asset-fingerprint.mjs /tmp/ci-dist /tmp/hosted-dist
```

This compares SHA-256 per logical JS/CSS asset and prints only changed logical
keys and byte deltas. The provider logs alone only prove **aggregate JS/CSS
digest equality/difference**, not which chunk changed.

The following read-only eligibility gate is also implemented but **is not wired
to any live deployment trigger**:

```bash
GITHUB_REPOSITORY=carlers/mosaic-life-tracker \
PREVIEW_DEPLOY_BRANCH=fix/workflow-build-parity-592-20261012 \
PREVIEW_DEPLOY_SHA=<exact-40-character-sha> \
GITHUB_TOKEN=<trusted-read-only-token> \
node scripts/check-preview-deploy-gate.mjs
```

The gate checks the live branch head, full SHA, official GitHub Quality Gate
workflow run and its matching successful `canonical-acceptance` check suite.
It rejects mismatched SHAs, newer failed runs, source branch changes, fake
standalone `build` success, non-Preview branches and non-official repositories.
Run it immediately before any future Preview deployment, as well as before a
prebuilt candidate is created. This check **does not** prove Vercel feature
parity, same-hash deployment, branch alias correctness, or deployment
idempotency. A future trusted build/deploy workflow must handle those gates.

**Security:** Never put the Vercel token or GIPHY key in a public workflow log,
GitHub artifact, issue, comment, or untrusted PR job. Use a reviewed,
protected GitHub deployment environment and only deploy an already-accepted
exact source SHA. Keep normal Git-triggered Preview deployments enabled until
a proven canary fully replaces them.

## Protected, deliberately disabled Preview canary (#592)

The normal `Quality Gate` workflow now includes a protected `preview_canary`
job. It is **not enabled by default**. Ordinary pushes, PRs, and regular
workflow dispatches cannot enter the job. It requires **all** of:

- Manual `workflow_dispatch` on the **stable Preview branch**, specifying
  `preview_canary_sha` equal to its exact accepted Git HEAD.
- The complete `canonical-acceptance` job in that manual run passing.
  An independent build-only success is insufficient.
- Owner-configured repository variable
  `MOSAIC_PREBUILT_CANARY_ENABLED=true`, and the
  `mosaic-preview-canary` GitHub environment configured with an
  **actual required reviewer** and an environment-scoped
  `MOSAIC_PREVIEW_CANARY_VERCEL_TOKEN` secret. The environment MUST
  restrict the deployment branch to approved stable Preview refs. Do not
  enable the variable before those protections exist.
- An exact branch/ref/SHA/repo/project check followed by a live GitHub
  canonical check-suite and branch-head verification.

The job checks for an existing active/READY canary before attempting work,
then installs pinned Vercel CLI 62.7.0, pulls **effective branch-scoped
Preview variables** using `vercel pull --environment=preview --git-branch`,
builds under Node 24 with `VERCEL_ENV=preview` and exact commit identity,
revalidates GitHub evidence and Vercel canary idempotency, and only then
invokes `vercel deploy --prebuilt --target=preview`.

The build runs the unchanged seven budget gates and JS/CSS fingerprinting
using the intended hosted feature configuration. Pulled settings live only
in the disposable runner, not a GitHub artifact. Secrets, `.vercel/`
contents and generated code must never be uploaded to CI logs or public
issues. A successful canary deployment must have **its own exact
SHA/Preview/Scratch/feature/alias and deployed fingerprint readback** verified
before this job is eligible to replace Git pushes. The script's GitHub
gate does not prove Vercel deployment metadata or branch-alias behavior.

**Operational limitation:** This canary still requires the repository owner
to configure a protected environment and grant access to the Vercel token.
Neither token presence nor protected reviewer rules can be inferred from
GitHub workflow YAML. No workflow or protected secret is configured by the
canary's code alone. Keep Vercel Git-triggered Preview delivery enabled
until a successfully verified replacement demonstrates correct stable
aliases, zero deployments for rejected candidates, and idempotent retries.
`dev`, `main`, Production and Scratch backend remain untouched.

### Recovery if the canary cannot run

Unset or leave `MOSAIC_PREBUILT_CANARY_ENABLED` disabled. The job will be
skipped; existing canonical CI and Git-triggered Vercel deployment retain
their prior behavior. Never turn off Vercel auto delivery or relax the
build-size budgets merely to make the canary pass. An explicitly approved
canary is a test, not a general rollout authorization.

### Repair for silently skipped manual canary jobs

GitHub Actions may propagate a skipped ancestor's implicit `success()` status
through a successful intermediate job. Normal Mosaic `canonical_acceptance`
depends on several optional Quality Gate jobs, including skipped
`promotion_check`. Thus a downstream canary's composite job-level `if`
can be **SKIPPED** even though canonical acceptance succeeded and the owner
provided the valid SHA, repository variable, and environment secret.

The canary now explicitly begins its job-level condition with
`always() && !cancelled()` and **still requires** a successful
`canonical_acceptance`, official repository, manual dispatch, branch
reference, exact SHA input, and repository opt-in. This avoids skipped-ancestor
inheritance without bypassing any security gate or running during cancellation.
Regression tests assert this critical YAML contract. A successful canonical
run plus a skipped canary from before this fix does **not** establish token,
environment, or Vercel readiness. After a reviewed stable-branch release,
only one fresh manual dispatch on the **new stable SHA** can exercise it.

Evidence: manual Quality Gates `38280478916` and `38282072296` passed
canonical but skipped the canary, even with owner screenshots confirming
the variable, SHA input, environment secret and protection settings.

### Bounded Vercel history after the first protected canary execution

The approved manual canary run `38284531918` entered its protected
environment and verified correct manual SHA, branch, official project,
GitHub canonical acceptance and presence of the Vercel token. It then
failed safely **before any deployment** because the five-page history
inspection covered the project's full history (>500 deployments).
This was not an authentication error, and no canary build began.

The corrected duplicate check uses the checked-out **Git commit timestamp
minus one hour** as Vercel's server-side `since` bound. A deployment
of the exact source SHA should not predate its own commit; the margin
allows modest timestamp disagreement. The API supports millisecond
`since`, confirmed against the Mosaic project: the current SHA's
one-hour-safety window returned three deployments without truncation.
The five-page cap, advancing-cursor validation, active/READY metadata
matching, SHA/branch checks and fail-closed incomplete-history handling
remain intact. Older candidate commits with genuinely enormous recent
histories can still fail safely and require a new reviewed candidate;
this is preferable to blindly redeploying.

To test the protected path again, publish this repair through focused
task → stable Preview canonical/READY and manually dispatch **the new
stable SHA**. Do not rerun the old SHA and expect a source change.

### Missing local app dependencies in the first effective Preview build

Owner-approved manual Quality Gate [`38287002114`](https://github.com/carlers/mosaic-life-tracker/actions/runs/38287002114) proved the corrected time-window Vercel duplicate scan and authenticated
`vercel pull --environment=preview --git-branch` work. However,
`vercel build` on the GitHub runner returned `TS2688` for
`vite-plugin-pwa/client`, `vite/client`, and `node`: unlike hosted
Vercel builds, local `vercel build` did **not** install application
`node_modules`. No prebuilt deploy was attempted and no project
configuration or Vercel token change is required.

Install `npm ci --prefer-offline --no-audit --no-fund` in
`life-tracker/` from the reviewed lockfile after canary authorization
and duplicate check, before the Vercel build. Do not use floating
dependency installs, skip `tsc`, or relax build-size budgets. A workflow
regression asserts dependency installation ordering and protected job
gates. The next attempt must still prove exact Preview/Scratch build
settings and prebuilt Vercel deployment identity.

### Monorepo root mismatch after the successful protected build

Manual [Quality Gate 38288515284](https://github.com/carlers/mosaic-life-tracker/actions/runs/38288515284)
proved the protected build's app dependencies are now correctly installed.
Vite compiled successfully against the **Scratch** Appwrite backend with
GIPHY enabled and Node 24.21.0; all seven size guards passed. Vercel CLI
62.7.0 subsequently failed `No Output Directory named "dist" found`
despite Vite producing `dist/index.html`. This was a **Vercel CLI
working-directory mismatch**, not an application build failure.

Mosaic's Vercel project has the monorepo app root `life-tracker/`.
Hosted Vercel Git builds resolve that directory from Git root, while
the initial protected canary called Vercel from inside `life-tracker/`.
Per the official Vercel Root Directory guidance, call the CLI from the
**repository root** with `.vercel/project.json` there; Vercel
will resolve the configured project root `life-tracker/` itself.
Leave the `npm ci` step in `life-tracker/`. Verify
`life-tracker/dist/index.html` and `.vercel/output/config.json`
after the Vercel CLI build and before the second exact-SHA/idempotency
checks and deploy. Do not change remote project settings, headers,
rewrites, Scratch backend or output budget ceilings to work around it.

**Separate parity caution:** The local canary build printed the emitted
JS/CSS fingerprint `e24cedd82c122636d6f9aa06a6b7774c08235ee8769b1eccb5128659532dfbca`,
while Vercel's previous exact-SHA Git-triggered build printed
`13df5b4294dbd54b6a15e1a62679f499671f70b27f854b7fc3332be7f4cae4ba`.
Both were Scratch, GIPHY enabled, Node 24.21.0 and their seven size
budgets passed, but artifacts remain different. This could reflect
additional build-context variation or nondeterministic chunk output.
**Do not claim byte-equivalent builds or deactivate automatic Git
deployment until this is investigated and accepted.**

### Successful protected prebuilt canary and rollout gap (2026-10-12)

The owner retried failed jobs of [manual Quality Gate #38290165183](https://github.com/carlers/mosaic-life-tracker/actions/runs/38290165183) on stable SHA
`c6b4dd304efcdeb616398ce432d10480ff55f3e0`. **Attempt 2 SUCCESS**:
full GitHub canonical suite, protected environment, exact SHA and branch,
Vercel secret, live GitHub check-suite validation, effective Scratch/GIPHY
Preview `vercel pull`, `npm ci`, `vercel build`, all seven budgets,
prebuilt packaging, and `vercel deploy --prebuilt --target=preview`.
Vercel readback confirms CLI deployment
`dpl_9CgjZjmxMCqSqZxEkSpVspxKbB3d` is **READY** and has the
same full SHA, in Preview (no production target). It has a standalone URL
`mosaic-life-tracker-ni5kbsjw7-carls-projects-72516fde.vercel.app`,
but **no registered stable-branch alias**. The ordinary Git-triggered
`dpl_7TcELUag2fVQqpnRSVuP41buikJB` remains READY and owns the
stable alias.

**Idempotency readback correction:** The Vercel deployment-list API
reported the prebuilt CLI candidate's `meta.githubCommitRef=HEAD`,
`meta.githubCommitSha` matching the exact accepted commit, and official
GitHub owner/repo but did not expose the supplied custom `--meta`
canary tags. Since the old checker only matched custom tags, it could
mistake the already READY canary for a missing deployment and waste a
duplicate quota unit. The checker now also recognizes this **exact
official-repo SHA with CLI `HEAD` identity**, excluding production,
failed deployments, wrong sources, and normal Git-branch deployments.
A matching same-SHA CLI deployment without exposed branch metadata
is conservatively treated as a duplicate rather than risking re-upload.

**Byte-level parity remains unverified.** The protected local build's
JS/CSS SHA-256 `e24cedd82c122636d6f9aa06a6b7774c08235ee8769b1eccb5128659532dfbca`
differs from the normal Git-hosted build's
`13df5b4294dbd54b6a15e1a62679f499671f70b27f854b7fc3332be7f4cae4ba`
for the *same commit*, even though both use Node 24.21.0, Scratch and
GIPHY enabled. Both build budgets passed. Many hashed JS chunk names
differ without changing logged chunk sizes. Avoid attributing a cause
without a manifest-keyed content comparison.

**Do not disable Vercel Git-triggered Preview delivery yet.** The
automatic replacement must ensure a stable branch alias, exact
accepted commit, canonical green, trusted Preview secrets, no trigger
on failed CI, idempotent reruns, and no human GitHub dispatch/reviewer
for normal feature work. Keep `mosaic-preview-canary` environment
reviewer until any new automatic, appropriately restricted environment
is explicitly configured and safely proven. Release promotion remains
separate and explicit; no `dev/main` or Production change in #592.

### Automatic CI-gated Preview pilot (staged; no automatic rollout yet)

The first protected local canary **did deploy successfully**:
[Quality Gate 38290165183 attempt 2](https://github.com/carlers/mosaic-life-tracker/actions/runs/38290165183),
Vercel `dpl_9CgjZjmxMCqSqZxEkSpVspxKbB3d` READY, exact SHA
`c6b4dd304efcdeb616398ce432d10480ff55f3e0`, Scratch Appwrite,
GIPHY enabled, Node 24.21.0 and seven unchanged size budgets PASS.
The canary has no branch alias, whereas normal Git Preview did.

An **automatic, default-disabled pilot** now exists as a distinct
`automatic-preview-pilot` job in `Quality Gate`. It is deliberately
restricted to branch `fix/workflow-build-parity-592-20261012` and
the single known existing stable Vercel Preview hostname
`mosaic-life-tracker-git-fix-work-73127a-carls-projects-72516fde.vercel.app`.
Its prerequisites and failure policy:

1. `push` only, official repo and exact accepted branch/SHA, opt-in
   **Actions repository variable** `MOSAIC_AUTO_PREVIEW_ENABLED=true`,
   and successful full `canonical_acceptance`. Only the current
   exact push's `in_progress` Quality Gate is admissible, and only
   if GitHub's **same check suite** already has a completed, successful
   canonical-acceptance. A failed, canceled, stale or untrusted run
   cannot deploy. Avoid cyclically requiring the whole parent run
   to complete while this downstream job is still running.
2. A new **separate GitHub environment** `mosaic-preview-auto`
   must have a **branch restriction to only** this stable branch
   and scoped environment secret
   `MOSAIC_PREVIEW_AUTO_VERCEL_TOKEN`. For unattended delivery
   this environment must not require a per-run reviewer. Do **not**
   move or remove the existing reviewed `mosaic-preview-canary`
   credential/protection. This is a one-time owner/admin security
   decision; a GitHub connector without environment-admin rights
   cannot configure it. Never paste a token in chat.
3. Detect existing active/READY exact-SHA CLI deployments from provider
   metadata. Reuse rather than create a duplicate. Else
   `vercel pull` effective branch Preview settings,
   `npm ci` exact lockfile, `vercel build` Scratch/GIPHY and all
   seven size gates, check output layout, re-check exact SHA and
   dedupe, and upload `--prebuilt`. No token is placed in
   job-global env. Token-bearing steps use environment secrets.
4. Before altering the stable alias, fetch the newly READY
   deployment through the authenticated Vercel API. Require
   exact SHA, official owner/project, CLI source,
   `githubCommitRef=HEAD`, Preview target and the **one**
   expected stable alias. Check the GitHub canonical+HEAD gate
   again. Use documented `vercel alias set`, then read back
   the exact alias on the accepted deployment. **Do not alias
   Production, dev, other branches or a non-READY deployment.**

**Do not set the opt-in variable yet.** Initial disabled-pilot tests
only prove contract logic and ordinary-Preview noninterference.
Required controlled acceptance before flipping and replacing Git
auto-delivery: owner provisions the narrow unattended environment;
one staged, supervised exact-SHA rollout verifies GitHub job,
CLI canary idempotency (including reuse), Vercel alias reassignment
and readback, Scratch/browser behavior, quota utilization, and
a CI-red run producing no deployment. Resolve the outstanding
same-SHA asset fingerprint mismatch first or explicitly accept a
well-tested semantic-equivalence bound; never assert byte parity
without measured identical hashes. Only after proof disable the
**specific pilot branch's** Vercel Git-trigger, not all fix/feature
branches and not `dev/main`. Fully generalizing stable Preview
aliases across branches requires separate reviewed discovery rules.

This process is intended to remove GitHub manual workflow dispatch
and reviewer approvals from **routine** development. Explicit user
approval remains mandatory for dev/main promotions and sensitive
Production/backend changes. #592 remains open for final activation,
build budget policy, twice-weekly/monthly size audits and
five-promotion pilot acceptance.

### Shadow-before-alias correction and unattended credential trust gap

Automatic Preview is now staged into **two independently disabled
phases**. Repository variable `MOSAIC_AUTO_PREVIEW_ENABLED=true` would
start an accepted single-branch CI-green automatic **shadow** build and
prebuilt Preview deployment. Even when enabled, the known stable
testing alias **cannot change** unless separate
`MOSAIC_AUTO_PREVIEW_ALIAS_ENABLED=true` is set. The three mutating
alias steps (fresh GitHub SHA evidence, `vercel alias set`, and
authenticated alias readback) require that additional flag. Shadow
mode still verifies the actual READY CLI deployment. The verifier
rejects alias post-checks when that flag is absent and rejects Vercel
deployment records with unknown/missing or Production target.

**Do not enable either flag or provision a no-review deployment
credential yet.** Only restricting a secret-bearing GitHub environment
to a stable branch is not a sufficient trust boundary if automated
contributors can alter that branch's workflows, package install
scripts or build steps. `npm ci` and `vite build` can execute source
from the accepted branch; remote Vercel Preview credentials and local
`.vercel` environment files must not become available to arbitrarily
modifiable code. Before owner setup/activation, harden a genuinely
trusted workflow/branch ruleset and credential isolation, review
effective GitHub token permissions and minimize GitHub/Vercel
secret exposure. A one-time trusted owner/admin review may still
be required, but routine feature work should not require human
deployment approvals.

The parity check is still unresolved: both same-source builds show
150 emitted JS/CSS assets, Scratch, GIPHY enabled, Node 24.21.0 and
Vite 8.3.0, but numerous hashed chunks differ despite matching
reported rounded sizes. Asset fingerprints differ
(`e24cedd82...` CLI and `13df5b42...` hosted).
This evidence cannot distinguish one differing value propagating
through import hashes from wider build nondeterminism. Do not
assert byte parity or prematurely relax budgets. Work must
determine the actual differing emitted content before replacement.

### Trusted default-branch receiver prototype — not yet active

**Security correction:** The earlier `preview_auto_pilot` runs in the
same Quality Gate workflow as the AI-editable stable branch, and has
a Vercel token available in its job. Branch restriction and green CI
do not eliminate the risk that edited checkout/build scripts obtain
that token. The old job is now **hard-disabled** with an explicit
`false &&` in its job-level condition, independent of repository
toggle values. Do not provision or expose its credential.

A replacement `.github/workflows/trusted-preview-delivery.yml`
listens for **completed** `Quality Gate` through `workflow_run`,
an event whose workflow definition executes only from the repository
**default branch** (`main`). This file is currently staged **only
on the stable #592 Preview branch**; it will not be active until
a separately authorized promotion to `main` and the explicit
`MOSAIC_TRUSTED_PREVIEW_ENABLED=true` repository variable.
The trusted main checkout (not triggering source) runs
`scripts/run-trusted-preview-receiver.mjs` using built-in Node APIs.
It does NOT check out candidate source, run candidate NPM scripts,
download untrusted CI artifacts or locally build a Vite bundle.
The Vercel credential is available only in this privileged step.

The receiver rejects non-push/failed/stale/noncanonical runs,
wrong owner, workflow name/path, SHA/branch or check suite. It
independently refetches the latest accepted same-SHA Quality Gate,
successful canonical check and current branch HEAD. It checks
a five-page bounded Vercel history window for existing active/READY
same-commit builds (including ordinary Git builds). On cache miss,
it first validates the linked Vercel project ID, GitHub repo ID,
monorepo root and **production branch = main** before issuing one
Vercel-hosted Git-source deploy request with the exact accepted SHA
and official project/ref. It never runs source code in the
credential-bearing GitHub runner. The hosted Vercel builder uses
the existing Preview/Scratch branch settings, avoiding the extra
GitHub-local rebuild that caused the same-SHA fingerprint discrepancy.
The response is polled to READY, then checked for exact official
metadata and a non-production target; an unexpected target fails
closed. The standalone READY Preview can be accepted in shadow mode.
A **separate** `MOSAIC_TRUSTED_PREVIEW_ALIAS_ENABLED=true` switch,
plus a fresh GitHub HEAD/CI recheck, is required before an API alias
assignment and verified readback on the known #592 stable Preview URL.

The remote Git-source API itself is **not yet exercised**; its
exact Vercel project binding and preview target behavior require
a controlled non-production pilot after security review. The
`workflow_run` file on stable #592 is only a staged proposal, not
an active main workflow. **Do not merge to main or activate it
without owner authorization.** Existing Git-triggered delivery
must stay enabled until safe shadow, alias, stale/CI-red and
quota tests pass. Vercel free-tier API deployments have a daily
limit, so the first pilot should reuse an existing exact-SHA
hosted Git deployment where possible.

Once trusted source promotion and one-time environment setup
are approved, normal feature delivery should require **zero
manual GitHub dispatch/review per change**. The current manual
canary remains completed/protected and needs no repetition.
Dev/main release approvals and Production/Appwrite safety remain
separate. Issue #592 is still open for activation, branch
generalization, periodic size audits and promotion sampling.

## First credentialless artifact handoff slice (#592; 2026-10-14)

The existing canonical **build job** now does one `npm run build` as before,
then inventories **all** emitted Vite/PWA files and uploads a short-lived
(non-executable) evidence envelope plus `dist.tar.gz` to GitHub Actions.
`scripts/preview-build-evidence.mjs` records the exact source SHA/ref,
all seven size measurements, JS/CSS logical fingerprint, a SHA-256 per
emitted file and deterministic inventory digest. Local/regression verification
rejects malformed source, tampered files, symlinks and missing manifest/SW.
Evidence and archives stay outside `dist/`, never enter PWA precache, never
call Vercel or use a Vercel token. The tarball is just a **candidate build
output**; it is NOT executable or authorized to deploy merely because
the build subjob passed. All canonical shards must still succeed.

The envelope deliberately includes
`kind=non-deployable-ci-build-evidence` and
`deploymentAuthorized=false`. This is NOT yet the exact deployable
Scratch/GIPHY artifact: the current public CI build profile differs from
the hosted Vercel Preview profile, and raw `dist/` is not automatically
equivalent to the provider's Build Output v3 with its rewrite/headers
configuration. **Never upload this artifact to Vercel**. The separate,
trusted default-main receiver must later pin the source CI workflow
version, verify fresh branch HEAD and entire canonical acceptance, fetch
the official artifact by GitHub run ID, validate archive/inventory
integrity, prove effective public Scratch/GIPHY build context and
Vercel output/headers equivalence, and only then allow one
`--prebuilt` Preview deployment under separate credentials.

The first slice demonstrates source/build reuse **without initiating a
Vercel POST**, keeping the user-visible app, budgets, aliases, and
Production untouched. Failure of a build step produces no upload;
failure of another canonical job leaves an artifact that is strictly
**ineligible** for deployment. Do not turn off Git automatic branch
Previews until a trusted negative red-CI canary demonstrates zero
new Vercel deployment creations after the proposed cutover.
