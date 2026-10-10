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
