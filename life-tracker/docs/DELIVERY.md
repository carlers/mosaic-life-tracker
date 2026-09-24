# Verification and Preview delivery

## Authorized completion

Commit only task paths (never blanket-stage unrelated edits), use a `chatgpt/**` task
branch, and push after focused checks and diff review. Prefer one coherent commit; repair
commits are appropriate when CI exposes a defect. Include `[verify:full]` on the final
commit. Wait for that exact SHA's `canonical-acceptance`, then fast-forward `preview`
to it and verify the Preview guard and Vercel deployment. No force push across divergence,
no automatic main merge, and no unrelated remote service changes.

If tools/network prevent a step, complete independent work and report the exact blocker.
Do not ask for authorization already granted. Include commit SHA/subject, checks, and
Preview status in the final result. Do not commit status-only prose after acceptance.

## One CI workflow

`.github/workflows/verify.yml` selects:

| Mode | Trigger and work |
|---|---|
| Docs | Ordinary Markdown-only changes: contracts and diff checks, no dependency install |
| Focused | Ordinary runtime pushes to `chatgpt/**`: contracts/discovery, changed existing-file ESLint, Git-aware related tests |
| Full | Runtime PR, manual dispatch, or `[verify:full]`: checks (contracts/discovery/lint/unit/handlers), two DOM shards, build, two browser shards |
| Preview guard | Preview push: requires prior successful canonical acceptance on the same SHA |

A focused or docs-only green run is never acceptance for Preview. `[verify:browser]`
requests intermediate browser coverage. Canonical jobs overlap; the build retains a fresh
lockfile-driven npm ci. Other jobs reuse lockfile-keyed app dependencies with install
fallback. Browser packages and Chromium are cached separately. Shards use one browser
worker each. Preserve these gates and bounded concurrency settings.

Run focused checks during edits. Use CI for final full acceptance when available; do not
repeat a complete local suite just to duplicate the same gate. Without remote execution,
`npm run verify` plus prepared browser contracts provides local evidence, but cannot
authorize Preview without its canonical check. Manual device evidence remains separate.
While CI runs, finish independent review; otherwise wait between status requests. Read
full logs for failures or unusual stalls, not on every poll. Fix the actual failing layer.

## Provider and branch

The preferred provider is Vercel. Configure one Vercel project from
`carlers/mosaic-life-tracker` with:

- **Root Directory:** `life-tracker`
- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`
- **Production Branch:** `preview`

`life-tracker/vercel.json` contains explicit SPA rewrites for Mosaic's BrowserRouter
routes. Static assets are not catch-all rewritten.

The Git branch `preview` is deployment-only. The user has authorized it to advance after
every completed task. Once the exact final task commit has a successful
`canonical-acceptance` check, fast-forward `preview` to that immutable SHA and verify
the Vercel deployment. The Preview Verify run only confirms that prior exact-SHA acceptance
exists; it does not repeat the canonical test/build/browser suite. Do not merge feature work
through `preview`, create Preview-only code commits, or force-update it across divergence;
source development continues on normal task branches and `main`.

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

## Phone-review loop

1. Finish a task on its normal task branch and include the durable session/doc checkpoint
   before the final acceptance commit.
2. Put `[verify:full]` on the exact final task commit and require its
   `canonical-acceptance` check to pass.
3. Fast-forward `preview` to that exact verified commit as part of task completion.
4. Confirm the lightweight Preview prior-acceptance guard passes and the Vercel deployment
   becomes ready.
5. Share the stable preview URL when a manual/browser protocol is relevant.
6. The user performs any required phone/browser protocol.
7. Record manual evidence separately from automated CI evidence.

Do not add a state-only closure commit after canonical acceptance merely to record a run
number; derive completed workflow/deployment status from GitHub and Vercel. If repository
state truly needs another committed change, that new exact SHA becomes the task tip and
must receive its own required acceptance before Preview advances.

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
