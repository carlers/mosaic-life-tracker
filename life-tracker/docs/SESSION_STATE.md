# Session checkpoint
Updated: 2026-10-12
Current task: #408 — seven diary refinement regressions on isolated task branch.

- Source baseline: `feature/diary-408@09b905b693159b14c27cdae605288bfb84295691`, v0.25.0, previously canonical CI successful. `dev`, `main` and Production are not authorized for promotion.
- Working branch: `chatgpt/408-diary-refinements-20261012`, v0.25.1 candidate. Latest issue comment documents seven acceptance requirements and hardened plan.
- In-progress: owner double-tap-to-edit with tap disambiguation; Calendar Day View diary card and typed live diary-drag gap plus motion interpolations.
- Not yet accepted: social reply content navigation, owner-side reaction hydration, reaction-message events; automated CI/Preview, cross-account Scratch, mobile/browser/device validation.
- Shared Scratch Function/schema changes require an explicit coordinated activation approval, even if frontend and backend source are prepared. Do not modify Production or merge to dev/main.
Next: finish seven refinements, add relevant regressions, run task focused CI, squash into stable Preview for canonical Actions + Vercel READY, report real backend/manual blockers.
