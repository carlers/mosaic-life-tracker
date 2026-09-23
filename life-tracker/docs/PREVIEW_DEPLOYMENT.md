# Preview deployment

Mosaic uses a stable hosted preview so phone testing does not depend on a developer laptop
or a changing tunnel URL.

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

The Git branch `preview` is deployment-only. After a user-authorized task is verified
green, a GitHub-connected chat may move `preview` to that exact verified commit when a
phone/browser review is requested. Vercel then redeploys the stable production alias. Do
not merge feature work through `preview`; source development continues on normal task
branches and `main`.

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

1. Finish a task on its normal task branch.
2. Require the canonical GitHub Actions `Verify` run to pass.
3. When the user wants a hosted review, move `preview` to that exact verified commit.
4. Wait for the Vercel deployment to become ready.
5. Share the stable preview URL in the completion report.
6. The user opens that URL on the phone and performs any manual/browser protocol.
7. Record manual evidence separately from automated CI evidence.

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
