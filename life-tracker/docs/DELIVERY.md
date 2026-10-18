# Verification and branch delivery

## Authorized completion

When work originates from a GitHub Issue, include a stable issue reference in the
task PR and carry that context into the stable Preview handoff; see
[issue workflow](ISSUE_WORKFLOW.md). Use `Refs #N` rather than auto-closing
keywords before required main-release acceptance. GitHub Issue closure and Project
boards never replace branch, CI, Appwrite, manual, or promotion gates.


Commit only task paths (never blanket-stage unrelated edits) on a `chatgpt/**` or
`codex/**` task branch. Batch remote edits and prefer one coherent verification push rather
than pushing each small repair. GitHub-connected Chat must preflight Code Mode connector-call
count and use the phased Git-object write protocol in
[AI workflow](AI_WORKFLOW.md#github-connector-call-budget) instead of waiting for an oversized
program to fail. Ordinary task pushes intentionally run classification only.
The final coherent task commit must already contain the durable checkpoint/documentation for
the task and request `[verify:focused]` (or `[verify:browser]` when browser feedback is
specifically needed). A repair after focused failure requests focused verification again.

After that focused task SHA is green, open the pull request to the named stable Preview branch
(`fix/*`, `feature/*`, `perf/*`, `security/*`, `refactor/*`, or another explicitly
configured Preview category) and **Squash and merge**. The resulting stable Preview branch is
the one routine full canonical gate: it runs static/lint, unit, handler, DOM, production
build/PWA/size, and browser correctness in parallel and publishes the Vercel Preview. Do not
run the same full gate on the task branch merely to repeat it after squash. `[verify:full]`
remains a manual escape hatch for unusual diagnostics, not the normal final-task marker.

AI task branches are never merged directly into `dev` as part of ordinary task delivery.
Promotion from an accepted stable Preview branch to `dev` requires explicit user instruction.
For an exact merge promotion, `dev` first verifies that the push is a merged stable-Preview
PR, the merge tree is byte-for-byte the accepted source tree, the push first parent is the
previous `dev` SHA, and the source SHA has a successful `canonical-acceptance` check. When
all evidence matches, `dev` reuses that acceptance instead of rerunning the full suite. Any
missing/mismatched evidence fails closed to the normal full gate. `main` always retains the
full gate.

Do not make a documentation/status-only commit after CI turns green. GitHub Actions and
Vercel are the source of truth for run/deployment status; update repository state only when
the repository itself actually changed.

If tools/network prevent a step, complete independent work and report the exact blocker.
Do not ask for authorization already granted. Include commit SHA/subject, checks, and
deployment status in the final result. No force push across divergence and no unrelated
remote service changes.

## Versioned Preview and environment safety

Before user-testable Preview acceptance, agents set the planned version in the feature tree: new capability = MINOR, each later successful user-testable refinement = PATCH; never consume numbers for internal fixes or failed builds. Use `npm run version:check` (also enforced by `contracts:check` in CI). Compare main/dev/other active Preview versions to prevent collisions; a conflict needs a newly versioned, newly accepted Preview. Stable Preview -> dev -> main retains the exact accepted version without promotion-only code changes. Follow [versioning](VERSIONING.md).

Give all task squash merges and dev/main promotion merges an explicit descriptive subject and detailed body summarizing what actually changed (including aggregate work at production release); PR bodies retain mechanical acceptance/provenance. Preview and dev Vercel builds must use Scratch Appwrite, while official main uses Production. Build-time assertions enforce both targets and verify a Preview Function ID is explicit; Settings also exposes the runtime-effective Appwrite identity. In backend-dependent Preview handoffs, check the registered stable alias, scratch migrations/active Function, and disposable-user login; backend changes during a shared Preview can affect other branches before they merge. See [scratch runbook](SCRATCH_PREVIEW_WORKFLOW.md).

## Production publication (no agent-specific plugin required)

An approved `dev → main` release promotion continues to require an accepted Preview and explicit user instruction. The PR body must contain `## User-facing release notes`, with a concise complete aggregate summary of user-visible changes since the last production release. A successful merge is **not** a published release. A dedicated `Publish Production Release` Actions job runs after the exact `main` canonical gate, waits for matching live production build identity and Vercel status, then safely publishes a `vX.Y.Z` GitHub tag/Release. It skips non-version-changing commits; failed publishing is observable, can be retried through manual dispatch, and is reconciled every six hours. If the GitHub Actions token cannot write repository contents due to repository settings, maintainer must enable Actions read/write permissions. The public releases API is the sole source used by Settings history; publishing requires no Mosaic redeploy and no Appwrite table.

The one-time v0.12.1 historical bootstrap is pinned to the original production merge (never the later tooling-only main SHA). Its trusted publisher path requires the historic PR, canonical main CI, source version, production Vercel status and ancestry, plus current main CI and deployment status, before writing tag/Release. It does not bypass ordinary future version-increase checks. See [versioning](VERSIONING.md).

Agents should report the production PR, exact CI, Production Vercel readiness, publishing run, and Release URL individually. If the release job has not succeeded, explicitly say publication remains pending or failed rather than claiming complete delivery. For the original v0.12.1 release's historical-commit bootstrap, follow `VERSIONING.md` and issue #476; never retag a later workflow-only merge.

## One CI workflow

`.github/workflows/quality-gate.yml` selects:

| Mode | Trigger and work |
|---|---|
| Skip | Ordinary pushes to `chatgpt/**` and `codex/**`: classification only; this is the cheap WIP path |
| Focused | AI task commits carrying `[verify:focused]` or `[verify:browser]`: contracts/discovery, changed-file ESLint, Git-aware related tests; browser contracts are added only for `[verify:browser]` |
| Docs | Markdown-only changes on miscellaneous non-AI branches: contracts and diff checks, no dependency install |
| Full | Stable Preview branches, `main`, manual dispatch, or the explicit `[verify:full]` escape hatch |
| Promotion | `dev`: reuse accepted stable-Preview evidence only when PR provenance + identical tree + successful source canonical check all match; otherwise automatically fall back to Full |
| Branch delivery | Vercel deploys `main`, `dev`, and configured stable Preview categories; AI task branches remain blocked |

Quality Gate remains push-driven and does not duplicate work on `pull_request`. The task
branch focused check is development confidence, not canonical acceptance. Stable Preview
canonical acceptance is the routine release-quality proof for that tree. `[verify:browser]`
is for intermediate real-browser feedback; `[verify:full]` is exceptional. Manual device
evidence remains separate.

The full jobs stay parallel after promotion eligibility is resolved. Production build jobs
reuse the same lockfile-keyed `node_modules` cache as focused/DOM/browser jobs; cache miss
still runs `npm ci`. While CI runs, finish independent review. Read full logs for failures
or unusual stalls, not every poll, and fix the actual failing layer.

## Provider and branch

The preferred provider is Vercel. Configure one Vercel project from
`carlers/mosaic-life-tracker` with:

- **Root Directory:** `life-tracker`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Production Branch:** `main`

`life-tracker/vercel.json` contains explicit SPA rewrites for Mosaic's BrowserRouter routes and uses a deny-by-default `git.deploymentEnabled` policy. Stable Preview categories are enabled explicitly (currently `fix/*`, `feature/*`, `perf/*`, `security/*`, and `refactor/*)); `chatgpt/*`, `codex/*`, `temp/*`, and all other unlisted branches are blocked.
Static assets are not catch-all rewritten.

`main` is the production branch, `dev` is the integration/staging branch, and
category branches such as `fix/*`, `feature/*`, and `perf/*` are stable Preview
branches. There is no deployment-only `preview` branch. Source development continues on
these branches and AI task branches.

### Read-only PR preflight versus push-driven canonical races (#592)

A promotion PR `synchronize` event can be processed before the same exact source SHA's
push-driven `canonical-acceptance` exists or completes. The trusted-base
`check-promotion-pr.mjs` waits at most 140 seconds (15 evidence evaluations)
**only** when that unavailable/pending canonical result is the sole rejection.
Every retry re-reads the exact-SHA GitHub Actions check and both live branch refs
and PR metadata; any changed target/source, draft/closed PR, integration mismatch,
version regression, terminal failed canonical result or API error blocks immediately.
A deadline with no exact successful result also **fails closed**. Earlier successes
never override a newer queued/failed check. This is not an artifact trust bypass,
a source rerun, Vercel deployment, user approval or completed main release.

## Read-only promotion preflight (#592)

Before creating a new stable Preview → `dev` promotion PR, use the optional
`promotion:preflight` tool from `life-tracker/` with a locally available full Git
history and **read-scoped** GitHub/Vercel environment tokens. It is **not a merge
command**, a queue, or a replacement for explicit user approval.

```bash
GITHUB_TOKEN=<read-scoped-token> VERCEL_TOKEN=<read-scoped-token> \
PROMOTION_VERSION_IMPACT=none PROMOTION_BACKEND_DEPENDENT=false \
npm run promotion:preflight -- feature/example <expected-exact-dev-sha>
```

The tool reads live source/dev refs, exact source canonical CI, the Preview
Vercel deployment, sanitized build-feature scopes and application versions.
It runs local `git merge-tree --write-tree` without modifying Git HEAD, and
re-reads refs to reject an observed race. A conflict, missing/failed CI or
deployment, changed dev HEAD, feature scope drift, or version regression blocks
promotion. A different integration tree means **create a new integrated Preview
and rerun acceptance**. For backend-dependent work set
`PROMOTION_BACKEND_DEPENDENT=true` with `EXPECTED_SCRATCH_DEPLOYMENT_ID`
and read-back `OBSERVED_SCRATCH_DEPLOYMENT_ID`, and validate live Scratch
schema/consumer compatibility separately under the Scratch runbook.

A safe result is **advisory and short-lived**, never permission to merge;
verify GitHub HEAD/PR tree, current Vercel build and relevant active Scratch
deployment again immediately before an approved merge. Existing post-merge
promotion-verification and deployment gates remain authoritative. If
provider permissions or tokens are unavailable, fail closed and verify the
same evidence with connected GitHub/Vercel read tools; never skip it.

## Preview branch promotion policy

Individual development branches such as `chatgpt/*` and `codex/*` should enter the active stable Preview branch through **Squash and merge**. This keeps experimental development commits out of the durable Preview history while preserving the detailed development history in the pull request.

Stable Preview branches are direct children of `dev` for feature work and are the only
destination for ordinary AI task delivery. Never merge the task branch directly to `dev`
unless the user explicitly requests that promotion.

This is a **GitHub repository ruleset**, not a CI convention. The ruleset should target the
stable Preview categories and require:

1. Pull requests before merging.
2. The Preview merge-policy status check(s) required by the repository, once present.
3. **Merge type: Squash**.
4. No bypass for ordinary repository contributors.

Do **not** globally disable merge commits or rebase merges: stable Preview → `dev` and
`dev` → `main` intentionally retain their separate promotion policy.

The connected GitHub integration available to this environment can read repository rules
but does not have permission to create or edit them. Therefore the final enforcement step
is a repository-admin setting in GitHub; it cannot safely be represented as a source-file
change. Until that ruleset is active, the convention is documented but not technically
enforced.

## Why a stable hostname

Appwrite rejects browser origins that are not registered as Web platforms. A stable preview
hostname means the Appwrite project needs one preview platform entry instead of a new entry
for every branch/commit URL.

After the Vercel project is created, take its stable production hostname (for example,
`mosaic-preview.vercel.app`) and add that exact hostname in the Appwrite project:

1. Open the Appwrite project.
2. Add a **Web** platform/app.
3. Name it `Mosaic Preview`.
4. Set **Hostname** to the Vercel production hostname without `https://`.

Until that Appwrite platform exists, the static app can load but authenticated Appwrite
requests from the preview origin may be rejected by CORS.

**Share the stable branch alias, not the deployment-specific immutable URL,**
when giving users a Preview for login, signup, or other Appwrite-connected testing.
Vercel assigns a different deployment URL on each push; its hostname is not
automatically added to the scratch Appwrite Web-platform allowlist. The stable
branch alias follows the latest READY deployment and requires one registered
scratch Web platform. In the 2026-10-08 notification incident, the registered
alias was `mosaic-life-tracker-git-feature-beac29-carls-projects-72516fde.vercel.app`,
but the unregistered deployment host
`mosaic-life-tracker-n73x4jbnd-carls-projects-72516fde.vercel.app`
was shared and login failed with "Failed to fetch". Both hosts have since
been explicitly registered on **scratch only**.

Before handing off a browser-login Preview, list the deployment's actual
aliases and the target scratch project's Web platforms and verify the
**exact hostname** is registered. A Vercel READY status or a successful
HTML response does not prove browser Appwrite CORS compatibility.
For an immutable deployment URL that must be tested, register that one
hostname explicitly on scratch; never use an Appwrite wildcard or switch
the Preview to production as a shortcut. Include the registered, stable
alias in the handoff.

Vercel's per-branch preview URLs remain useful for static rendering checks, but they should
not be treated as authenticated Mosaic test URLs unless their hostnames are also registered
with Appwrite.

## Environment variables

The official Mosaic GitHub/Vercel project may use the checked-in production Appwrite fallback
**only for the production environment**. The Vercel Preview environment is explicitly
configured to the disposable scratch Appwrite project and the Vite build refuses
Preview targets that are missing the scratch project ID or its matching regional
endpoint; `dev` is a Vercel Preview target too. This prevents silent writes to
production from a new feature Preview. The backend project is embedded at build
time, so merely changing Vercel environment variables does not retarget an
already deployed build; trigger and verify a new Preview deployment. Check the
build log's `[Mosaic] Preview backend: scratch Appwrite` identity and Appwrite
Web-platform hostname before claiming authenticated Preview testing.
A fork must provide its own
`VITE_APPWRITE_*` values, normally generated by `npm run mosaic:bootstrap`, in the hosting
provider's build environment. An unconfigured fork resolves to a deliberately invalid Appwrite
endpoint instead of the original Mosaic backend. Browser `VITE_*` values are configuration,
not administrator secrets; provisioning/API keys must never use a `VITE_` prefix.

PostHog is optional for preview deployment. Without its browser environment variables the
adapter is a clean no-op. Production source-map upload is separately opt-in: set
`POSTHOG_SOURCE_MAPS_ENABLED=true` together with valid `POSTHOG_PERSONAL_API_KEY`,
`POSTHOG_PROJECT_ID`, and `POSTHOG_HOST`. The three build credentials alone MUST NOT
activate source-map upload, and Vercel Preview builds never run the upload even if those
build-only variables are inherited into Preview. This keeps an expired or unavailable
optional PostHog upload from breaking an otherwise valid Preview deployment. Production
and explicitly opted-in local builds retain source-map upload. If live Phase 3.7 staging
verification is desired, configure only the browser-facing Preview variables separately;
do not commit secrets.

## Backend-dependent Preview readiness

Before sharing a backend-dependent stable Preview for user testing, execute
the [scratch readiness workflow](SCRATCH_PREVIEW_WORKFLOW.md). It requires a
scratch-only managed-state check, approved additive migration reconciliation,
reviewed exact-commit Function activation, synthetic-data smoke checks, and
verification that the exact stable Preview hostname is an Appwrite Web
platform. The scratch CLI is read-only by default and refuses ambiguous
targets; it does not copy real accounts/data. The new steps run only when
the task depends on cloud/backend behavior; they do not add cloud work to
normal UI-only iterations. CI and Vercel READY never substitute for this
gate. Stop and report any unavailable API credentials/real-device acceptance
instead of claiming a passing backend gate.

## Efficient CI-first Preview evidence

After a stable Preview squash, verify the **exact stable commit's**
`canonical-acceptance`, then inspect the corresponding
`Trusted Preview Delivery` run. The trusted prebuilt deployment may be
created by CLI and lack `githubCommitSha` metadata; a Vercel deployment
search filtered solely by Git SHA can return zero results even when the
trusted deployment is READY. **Do not repeatedly run that failed search.**

Use the trusted run's explicit accepted SHA, canonical run ID and deployed
artifact/deployment ID as the provenance chain; confirm delivery success and
the actual READY deployment with a targeted lookup (or recent project
deployments when Git metadata is absent). Inspect full runner logs only if
the summary is insufficient, a job failed or the run is anomalously stalled.
Use the [latency discipline](AI_WORKFLOW.md#connected-chat-latency-discipline)
while waiting instead of repeated unchanged CI/Vercel polls.

For authenticated user testing, resolve the deployment's **stable branch
alias**, check that exact alias against Scratch Appwrite Web-platform origins,
and share that verified hostname. An immutable CLI deployment URL with
`READY` status proves neither alias registration nor authenticated login.
If no usable registered alias can be verified, report a Preview-login
handoff blocker rather than implying the immutable URL is authenticated-ready.
This does not change CI-first delivery or Scratch/Production approval gates.

## Branch deployment review loop

1. Finish the task on its AI task branch. Include the durable session/doc checkpoint in the
   same final implementation commit and request `[verify:focused]`.
2. Wait for that task SHA's focused check to pass. Use `[verify:browser]` instead only when
   the task needs intermediate real-browser evidence.
3. Squash-merge the focused-green task PR into the intended stable Preview branch.
4. Wait for that stable Preview SHA's automatic full `canonical-acceptance` and Vercel
   Preview. Fix failures on a task branch and repeat; do not patch the stable branch directly.
5. Share/use the stable Preview for any required phone/browser protocol.
6. Record manual evidence in the handoff/chat. Do not create a repository commit merely to
   record CI or deployment status.
7. Promote the stable Preview to `dev` only after explicit user instruction. An exact,
   already-accepted promotion uses the provenance/tree promotion check; any ambiguity falls
   back to the full gate automatically.

If repository state truly needs another committed change after acceptance, that change is
new work and receives the appropriate verification path.

For interaction-heavy changes, the hosted device check is part of acceptance even when DOM
regressions are green. In particular, verify Android/Samsung Back against nested bottom
sheets and verify nested horizontal carousels with real touch input: swiping the calendar
must move only the calendar, while swiping outside it may move the friend/person carousel.
OS history and real touch-recognizer behavior are not fully represented by synthetic DOM
events.

The hosted preview supplements GitHub Actions. It does not replace manual checks involving
touch behavior, screen readers, installed-PWA lifecycle, live PostHog dashboards, or other
external service state.

## Fallback

A local Cloudflare Tunnel remains a fallback when testing an uncommitted local workspace.
Its temporary hostname must also be registered in Appwrite before authenticated browser
requests will work.

## Build-feature parity and size diagnostics (issue #592, Batch A)

Vercel Preview is not one effective environment: branch-scoped overrides can
change frontend Vite feature availability even when the accepted Preview and
dev Git trees match. The October 11 read-only audit found
`VITE_GIPHY_API_KEY` scoped to `dev` and sticker Preview branches, **not**
generic `feature/*`/`fix/*` branches or Production. Do not assume a
same-tree Vercel output is identical to the accepted Preview. Ordinary Vite
build logs now report only whether GIPHY is effectively enabled. No variable
value is logged. Production availability still requires published-artifact or
browser verification: scope metadata alone is not an effective-build proof.

Before promoting an accepted Preview to `dev`, compare material frontend
feature-variable **presence/scope** with the read-only preflight:

```bash
# Save ONLY the key, target, gitBranch fields from Vercel's encrypted
# environment metadata. Never save decrypted or encrypted "value" fields.
node scripts/check-build-feature-parity.mjs feature/my-feature dev /tmp/vercel-env-scopes.json
```

The tool exits nonzero on material divergence. It intentionally ignores
Appwrite endpoint/Function differences between Scratch and Production. Scope
metadata cannot prove a configured value is nonempty; compare the effective
`[Mosaic] Build features` messages from the accepted and target Vercel
builds. If metadata, logs or access are missing, parity remains unverified and
promotion should stop. Batch B is responsible for wiring this preflight into
the existing promotion path; Batch A does not silently add another full gate,
alter Vercel scopes or copy keys.

The existing seven byte ceilings remain blocking and unchanged. Failed local,
CI and Vercel size checks now include a largest-emitted-asset and static
closure diagnostic; if both exact build artifact directories are available,
use `node scripts/compare-build-size.mjs <accepted-dist> <candidate-dist>`
to compare manifest-logical JS/CSS units, initial/Home closure and normalized
precache. This is read-only diagnostics, not an exemption from the guard.
Absent old artifacts, a reported same-tree footprint difference remains
unattributed; do not invent a byte-level cause from metadata alone.

Changes to `config/build-size-budget.json` require the cheap
`scripts/check-build-budget-review.mjs <base-commit>` Git diff contract,
enforced during focused verification and the canonical build. A raised
ceiling requires a *new* `review` record with an issue reference (e.g.
`#592`), meaningful rationale, a measurement/evidence HTTPS URL, the exact
list of raised metric names and their previous limit values. The review
record makes the policy change explicit for a human reviewer; it does not
constitute human approval on its own. A measured baseline reset is rejected
for separate review. Numerical ceilings are defined **only** in the budget
JSON, not repeated in the tests. Branch-protection enforcement and production
build parity are separate gates, not established by this script.

## Automated branch hygiene

The source-controlled [Branch Hygiene workflow](../../.github/workflows/branch-hygiene.yml)
runs daily **on main only**, with a manually dispatchable dry run (default) or
explicit live run. The policy is implemented in
[branch-hygiene.mjs](../scripts/lib/branch-hygiene.mjs) and
[cleanup-merged-branches.mjs](../scripts/cleanup-merged-branches.mjs).

- Never delete main, dev, an API-protected branch, or a branch outside the
  supported task (chatgpt/*, codex/*, task/*) and stable Preview
  (feature/*, fix/*, perf/*, security/*, refactor/*) categories.
- Delete a task branch only when its **current head SHA** equals the head of a
  successfully merged PR into a stable Preview branch, at least **72 hours**
  after the **most recent matching merge**.
- Delete a stable Preview branch only when its current head equals a successfully
  merged promotion PR into dev, at least **72 hours** after the most recent
  matching promotion. Promotion to main occurs via dev, not by deleting dev.
- Any open PR targeting **or sourced from** that branch blocks deletion.
  Unmerged, orphaned, renamed, divergent, or otherwise unproven branches
  remain for manual review; never infer success from age or branch prefix.
- Before live deletion, fetch the current branch protection/head and current
  head-related and base-targeted PRs again. Abort on API failures. A changed
  branch or newer PR must not be deleted under stale evidence.
- Each daily run deletes at most 100 qualifying refs, with the rest reconsidered
  the following day. Run results are recorded in Actions logs and job summary.
  No Appwrite resources, accounts, tags, or GitHub Releases are modified.

**Operations:** GitHub → Actions → Branch Hygiene → Run workflow, choose
main and keep **dry_run = true** to review candidates. Set false only for an
intentional live manual sweep. Scheduled runs are live after the workflow
exists on main. Keep GitHub's built-in immediate "Automatically delete head
branches" option **off** if a three-day post-merge grace period is required;
branch protection for main and dev remains defense in depth. Deleting a
stable Preview branch also ends that branch's stable Vercel Preview alias,
so use active open PRs rather than long-lived retired Preview branches
for ongoing work. GitHub PR history remains after branch deletion.

Test policy safety using npm run test:unit -- tests/unit/branch-hygiene.test.ts;
the full canonical Preview gate must pass before this scheduled workflow is
promoted to main.

## PR-time GitHub promotion evidence (#592, C0 candidate)

The proposed `Promotion PR Preflight` workflow runs read-only on **every PR to
`dev` or `main`**, including documentation-only PRs (no `paths` filter). It checks
the exact source canonical GitHub Actions result, current head/base SHAs,
live PR metadata (including draft status, target, and source), source
repository/branch, integration-tree equality, and version regression.
Converting a previously ready PR back to draft also reruns the check; an
outdated event payload cannot authorize a changed or closed PR.
Its script is loaded from the **target base SHA**, not executed from the PR.
It uses a read-only GitHub token, no Vercel/Appwrite keys, and changes nothing.

**Not a complete promotion acceptance:** the check does *not* verify Vercel
READY, Vite build-variable parity, effective Scratch Function/schema, manual
acceptance, or explicit user permission. Continue running the full
`promotion:preflight` and performing provider read-back before approved
merges. Do not make `promotion-pr-preflight` a required dev/main status check
until an actual PR to **each** target has produced the status on the correct
SHA, integration/changed-head/rejected-PR cases have been demonstrated, and
GitHub administration/permissions and strict-check behavior are reviewed.
`canonical-acceptance` is push-triggered; never require it as a PR check.
No new protection setting, queue, or auto-merge is authorized.

## #592 CI-first inherited stable-branch source policy — awaiting dev promotion

The reviewed rollout candidate disables Git-triggered Vercel deployment on
single-leaf `feature/*`, `fix/*`, `perf/*`, `security/*`, and
`refactor/*` branches **from their first commit**. `dev` and `main` remain
Git deployed; quiet task branches stay disabled. A plain unmatched `"*":false`
is not a safe fallback for names containing `/`, so each intended category
has an explicit `false` rule with no overlapping `true` rule.

**Current gate (2026-10-15):** The protected-main trusted receiver/writer was
owner-approved in PR #894 and has accepted two genuine feature Previews under
this exact inherited source policy: #852 v0.28.0 (canonical #38703473737,
trusted #38703741227), and #851 v0.29.1 (canonical #38710984351,
trusted #38711265392). Both published one CI-first immutable CLI Preview
after canonical SUCCESS; no Git-first build was created at the reviewed
stable SHA. #851 is owner-accepted; #852's human acceptance is separate.

The remaining generalization step is to promote this source policy to
`dev` as an **independently fully verified stable infrastructure candidate**.
It must not be silently merged into `dev`: require full exact stable canonical
acceptance, provider readback, owner approval of the promotion, and dev
exact-tree gate. This applies to *new* stable branches inheriting `dev`
after the promotion; previously created branches retain their own source
config, which must still be inspected before any rollout. Keep `main` and
`dev` on Git deployment. The generic trusted receiver must remain enabled
and accepting the exact new config before disabling Git-first on future
stable branches. If the privileged writer is turned OFF for rollback, restore
Git-deployment rules through a reviewed source change **before** continuing
new stable branch delivery; switching a flag off alone strands Git-disabled
Previews. Preserve existing accepted Preview URLs. Follow
[#592 revised plan](https://github.com/carlers/mosaic-life-tracker/issues/592#issuecomment-6186555585)
and continue to require user acceptance for product features and separate
explicit stable→dev authorization for every promotion.

A full green canonical gate by itself does not authorize provider configuration
changes, Production backend writes, `main` product promotion, or a 1.0 tag.
