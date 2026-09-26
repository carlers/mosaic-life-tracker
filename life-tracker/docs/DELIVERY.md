# Verification and branch delivery

## Authorized completion

Commit only task paths (never blanket-stage unrelated edits), use a `chatgpt/**` task
branch, and push after focused checks and diff review. Prefer one coherent commit; repair
commits are appropriate when CI exposes a defect. Include `[verify:full]` on the final commit when full canonical acceptance is required. Wait for that exact SHA's `canonical-acceptance` before treating the implementation as remotely accepted. No force push across divergence,
no automatic `dev` merge, and no unrelated remote service changes.

AI task branches are never merged directly into `dev` as part of ordinary task delivery.
The task branch enters its named stable Preview branch (`fix/*`, `feature/*`, `perf/*`,
`security/*`, `refactor/*`, or another explicitly configured Preview category) through
a pull request and squash merge. Promotion from a stable Preview branch to `dev` requires
explicit user instruction.

If tools/network prevent a step, complete independent work and report the exact blocker.
Do not ask for authorization already granted. Include commit SHA/subject, checks, and
Deployment status in the final result. Do not commit status-only prose after acceptance.

## One CI workflow

`.github/workflows/quality-gate.yml` selects:

| Mode | Trigger and work |
|---|---|
| Docs | Ordinary Markdown-only changes: contracts and diff checks, no dependency install |
| Focused | Ordinary runtime pushes to `chatgpt/**` and `codex/**`: contracts/discovery, changed existing-file ESLint, Git-aware related tests |
| Full | `main`, `dev`, stable Preview branches, manual dispatch, or `[verify:full]`: checks (contracts/discovery/lint/unit/handlers), two DOM shards, build, two browser shards |
| Branch delivery | Vercel deploys `main` to Production and configured stable Preview categories to Preview; AI task branches remain blocked |

Quality Gate is intentionally push-driven: the workflow does not also run on `pull_request`, avoiding duplicate runner allocation for the same commit. PRs still receive the checks attached to the pushed head SHA. A focused or docs-only green run is never canonical acceptance. `[verify:browser]` requests intermediate browser coverage. Manual device evidence remains separate.
While CI runs, finish independent review; otherwise wait between status requests. Read
full logs for failures or unusual stalls, not on every poll. Fix the actual failing layer.

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

Vercel's per-branch preview URLs remain useful for static rendering checks, but they should
not be treated as authenticated Mosaic test URLs unless their hostnames are also registered
with Appwrite.

## Environment variables

Core Mosaic currently needs no Vercel secret to reach Appwrite because the browser endpoint
and project ID are part of the checked-in client configuration.

PostHog is optional for preview deployment. Without its browser environment variables the
adapter is a clean no-op. Production source-map upload is separately opt-in: set
`POSTHOG_SOURCE_MAPS_ENABLED=true` together with valid `POSTHOG_PERSONAL_API_KEY`,
`POSTHOG_PROJECT_ID`, and `POSTHOG_HOST`. The three build credentials alone MUST NOT
activate source-map upload, so an expired or unavailable optional PostHog upload cannot
break an otherwise valid Vercel build. If live Phase 3.7 staging verification is desired,
configure the appropriate Vercel Preview/Production variables separately; do not commit
secrets.

## Branch deployment review loop

1. Finish a task on its normal task branch and include the durable session/doc checkpoint
   before the final acceptance commit.
2. Put `[verify:full]` on the exact final task commit when full canonical acceptance is
   required.
3. Wait for that exact SHA's `canonical-acceptance` check to pass.
4. Squash-merge the accepted task PR into the intended stable Preview branch only; do not
   promote to `dev` unless explicitly requested.
5. Verify the Vercel deployment for the stable Preview branch is ready.
6. Share the relevant stable Preview URL when a manual/browser protocol is relevant.
7. The user performs any required phone/browser protocol.
8. Record manual evidence separately from automated CI evidence.

Do not add a state-only closure commit after canonical acceptance merely to record a run
number; derive completed verification/deployment status from GitHub and Vercel. If repository
state truly needs another committed change, that new exact SHA becomes the task tip and must
receive its own required acceptance.

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
