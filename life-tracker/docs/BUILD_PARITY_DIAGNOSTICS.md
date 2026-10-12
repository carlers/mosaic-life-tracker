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
