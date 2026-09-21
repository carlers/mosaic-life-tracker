# Session state

Updated: 2026-09-21
Current task: stable hosted phone/browser preview
Status: repository-side Vercel preview setup implemented; provider project/link and Appwrite hostname registration pending
Roadmap pointer: Phase 4 WCAG source remediation is verified; its browser/manual evidence can use the hosted preview once live
Checkpoint: Added `life-tracker/vercel.json` with explicit BrowserRouter SPA rewrites, `docs/PREVIEW_DEPLOYMENT.md`, Vercel metadata ignore rules, and preview-workflow contracts. The intended deployment topology is one Vercel project rooted at `life-tracker/` with production branch `preview`. A stable hostname is deliberate because Appwrite requires browser origins to be registered as Web platforms.
Next action: Connect/create the Vercel project, set Root Directory=`life-tracker` and Production Branch=`preview`, obtain the stable Vercel hostname, then register that hostname once in Appwrite as `Mosaic Preview`. After that, hosted phone review becomes part of the GitHub-connected workflow.
Blockers: Vercel account connection is user-authorized but still requires the user to connect the Vercel ChatGPT plugin/account. Appwrite currently has no ChatGPT connector, so registering the final hostname may require one short Console action by the user after the hostname exists.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries only an exact verified commit selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Working set

- `life-tracker/vercel.json`
- `docs/PREVIEW_DEPLOYMENT.md`
- `README.md`
- `AGENTS.md`
- `scripts/check-project-contracts.mjs`
- `.gitignore`
- `SESSION_STATE.md`

## Verification

- Repository-side configuration is pending the canonical GitHub Actions gate for this task commit.
- Actual Vercel deployment and Appwrite-origin behavior remain external/manual until the provider project is linked.
- The last WCAG checkpoint head was fully green in GitHub Actions run 35551770730.
