# Mosaic public landing page (#1442)

A standalone, static public developer-project site. This directory is independent
of the authenticated life-tracker PWA. No Appwrite keys, source imports, PWA
service workers, analytics, build dependencies or authenticated functionality.

## Local development and verification

Run `node landing/test-site.mjs` from repository root. Serve the `landing/`
directory as static files (e.g. `python3 -m http.server 8765 --directory landing`).
The Vercel project **must** have Root Directory set to `landing`,
Framework Preset **Other**, with **Include source files outside of Root Directory** enabled. The build/install/output commands are pinned in `landing/vercel.json`.

The hero preview follows the actual Mosaic black-theme **month calendar** layout,
including friend/person selection, calendar view switcher, colored task bars and
bottom navigation. It is built entirely from HTML/CSS and uses clearly fictional
sample entries. The provided real-world reference screenshot contains personal
content and is **not** published or included in this repository.
Before registration, capture an actual screenshot of this public landing site;
never capture private Mosaic tasks, Diary entries or messages.

Current browser-facing copy only describes functionality already documented
in the Mosaic source README; the dedicated Diary view and planned integrations
are intentionally excluded. The application link is the existing PWA URL.
Do not infer that this repository is licensed as open-source merely because
the repository is publicly readable.

## is-a.dev boundary

The domain `mosaic-life.is-a.dev` is only a proposed hostname; it is not
owned, reserved or approved. Hosting at a Vercel-generated URL must work
before a registration request. The project's owner must read the latest
is-a.dev Terms and Quickstart, confirm noncommercial eligibility,
and **manually** write and submit any registration JSON and upstream PR.
is-a.dev discourages AI-created registration PRs, even while allowing AI-built
websites. Do not automate/fork/create its PR from this repository.
A domain does not guarantee an email provider accepts the sender or DKIM.

## Branding

The website's header, footer, tab icon and Apple touch icon use the exact
`apple-touch-icon.png` asset from `life-tracker/public/`, not a recreated
Mosaic mark or independent marketing logo. The static contract checks
byte-for-byte equality with the app's PNG. The original SVG remains in the
landing assets for backward compatibility but is no longer the active icon.

## Interactive demo — full Mosaic UI runtime (#1617)

The public demo uses a separate Vite entry under \`life-tracker/demo/\`, but
renders the **production** \`App\`, \`AppLayout\`, \`MainLayout\`, \`HomePage\`,
\`DayViewSheet\`, other routes, overlays and their shared CSS. The discontinued
bespoke \`DemoApp\` / \`demo.css\` are not rendered.

Demo-only module resolution supplies an in-memory fictional identity, a
separate local RxDB database named \`mosaic_public_demo_v1\`, and non-network
Appwrite/telemetry adapters. The entrypoint does not load the normal
\`main.tsx\`, register a service worker or start the remote sync boot chain.
Browser network APIs reject calls, and deployed CSP forbids connections.
Features requiring a real external service are not operational on the demo.

Build from \`life-tracker/\` with \`npm run build:demo\`, producing ignored
\`landing/demo/\` assets; run \`node landing/test-demo.mjs\` and
\`node landing/test-site.mjs\`. The independent site project's build command
must install tracker dependencies and build the demo before shipping the static
landing directory. Verify \`/demo/\` and direct \`/demo/home\` deep links.
Never deploy via the authenticated Mosaic PWA project.

## Automatic public-demo updates from main only (#1617)

The independent public landing Vercel project is connected to Mosaic's `main` branch, not `dev`. When new code is merged to `main`, Vercel's Git integration builds the actual `main` application UI with a browser-local fictional demo adapter. A `dev` push must never publish the demo. The PWA remains independent.

The build command in `landing/vercel.json` installs the locked tracker dependencies, builds `npm run build:demo` using the current checked-out `main` source, and runs both static site and demo contract checks. `assert-production-main.mjs` prevents any Vercel production build from a non-`main` Git ref. Failed builds do not replace the last healthy site. The repository's Quality Gate additionally builds the demo and runs its browser contract on merged source. Do not bypass the tests or security CSP to ship an incompatible future UI change.

The standalone Vercel project's **Production Branch** setting must be `main`, Root Directory `landing`, and **Include source files outside Root Directory** must be enabled. Demo-specific changes can be reviewed on Preview branches, but public builds only use main. This does not promote Preview/dev app code or migrate Appwrite.

## Standalone main-triggered mirror (issue #1617)

Only the released `main` branch supplies authenticated Mosaic UI code for this independent demo build. The build fetches a reviewed immutable demo-only adapter at `f24ddc175dca6c1c518624e408be8cfc9793ae96`; no unreleased `dev` UI code is imported. `landing/mirror-main.mjs` runs from Vercel's checked-out `main` source tree and refuses non-main refs. It verifies exact SHA matches remote main and the latest same-SHA GitHub Quality Gate `canonical-acceptance` result before building. A mismatch, CI failure, source incompatibility or security-contract failure prevents promotion. It installs locked tracker dependencies, builds real main UI with fictional browser-local services and emits Vercel Build Output API v3 static assets, CSP/frame restrictions and deep-link routes.

The independent `mosaic-project-site` Vercel project tracks Git Production Branch `main`, with repository root as Root Directory and `git` automatic deployments active (do not skip builds based only on changes to `landing` because `main` may update UI files elsewhere). Install Command is `echo install-in-build`; the Build Command fetches a pinned accepted bootstrap commit and executes `landing/mirror-main.mjs` through `git show`; Vercel serves the generated `.vercel/output`. On future main releases, repeat the exact-SHA canonical gate and publish only after success. The static fictional demo adapter can be updated separately after a stable Preview canonical gate, by changing the pinned immutable adapter commit in this script and the trusted bootstrap SHA in Vercel settings. Source incompatibilities fail closed instead of silently falling back to an unreleased dev build.

No authenticated PWA deployment or Production Appwrite changes are caused by these independent-site builds. The public demo may initially show older UI because the current released main version is v0.50.3 whereas a historical standalone demo used v0.76.0 source. Roll back only the independent landing-domain alias to an earlier READY Vercel deployment if needed.
