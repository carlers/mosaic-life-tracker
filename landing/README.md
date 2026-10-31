# Mosaic public landing page (#1442)

A standalone, static public developer-project site. This directory is independent
of the authenticated life-tracker PWA. No Appwrite keys, source imports, PWA
service workers, analytics, build dependencies or authenticated functionality.

## Local development and verification

Run `node landing/test-site.mjs` from repository root. Serve the `landing/`
directory as static files (e.g. `python3 -m http.server 8765 --directory landing`).
The Vercel project **must** have Root Directory set to `landing`,
Framework Preset **Other**, with no install or build step.

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
