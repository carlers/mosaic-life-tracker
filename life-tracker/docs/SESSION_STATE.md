# Session checkpoint

Updated: 2026-10-11
Current task: integrate accepted Settings history-return swipe v0.17.0 with latest `dev` v0.16.10. User authorized cleanup and promotion to `dev`, not `main`.

## Provenance and scope
- Settings feature stable Preview `feature/settings-history-forward` at `50a64692b8866134ddba7a39c38390e8b5df03aa`: full canonical run 38117583132 SUCCESS; Vercel deployment `dpl_6vRkuba7UudATeB1Hpx9douVJzeM` READY with Scratch.
- Current dev baseline `6a097ada3bf729d55fa959e7d03da551fea51930` includes granular release-history v0.16.10, release publishing work and corrected aggregate build budgets. Preserve it all.
- Apply only the feature's navigation source, its unit/DOM regressions, project reference and three v0.17.0 version fields over that baseline. Merge build budget by preserving dev aggregate/precache limits and accepting entry gzip 131752 (within existing baseline ratio); avoid resetting other ceilings.
- Settings left swipe reopens the last Settings child only after one-entry Back, with guarded route ownership and lazy child-page preview. Preserve right swipe, sheets, direct links, Alerts navigation, reduced motion, and Android/browser/Escape Back.

## Next action
- The first combined Preview (e8d5900) compiled but Vercel rejected entry gzip 131769 B vs strict 131752 B (+17 B); all other size limits passed. Reuse the already resolved current route parent during swipe navigation, then run focused CI and reaccept full stable Preview/Vercel before dev promotion. Preserve the startup-size ratio guard.
- AI task branch `chatgpt/settings-forward-dev-integration` targets stable integration Preview `feature/settings-forward-integration`. Request focused CI, squash to integration Preview, require full canonical Quality Gate and Scratch Vercel READY on exact Preview SHA.
- Then merge accepted integration Preview to `dev` via PR with source-provenance/tree acceptance, verify dev CI and Scratch Vercel readiness. Do not promote main.
- Manual iOS/Android swipe and Back with open sheets, and Escape-as-Back remain device-specific acceptance; do not claim them completed.
