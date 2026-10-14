# Session checkpoint

Updated: 2026-10-14
Current task: #592 secure CI-before-Vercel Preview cutover.

## Verified foundation
- `dev@f3d9558feca499e53c310c5a37be2794717bccf6` (v0.23.4) has #784 two blocking build budgets, five measurements; `main@f930e30442fe08b9981c29782843521c15e295e0` (v0.17.4) has the #784 audit, protected ruleset, and #592 reuse-only OFF receiver. No dev/main promotion for current task.
- Stable `fix/592-trusted-archive-20261014@44e176b272b8bc39b03dc5ef50877105d191428e`: full canonical #38497140645 SUCCESS; Vercel Preview `dpl_C5v6LxfiUv8t56qCaZxyS25252Wd` READY.
- CI already builds once, verifies 161-file bounded tar/inventory/source SHA, writes Vercel Build Output API v3 routing for 15 deep links and four headers via pinned official utility, reconstructs output and verifies byte equality without provider POST. `deploymentAuthorized=false`.
- Latest stable CI build uses exact Scratch Appwrite endpoint/project, Node 24; size guards pass. Its GIPHY and PostHog browser-public inputs were not configured then. Owner has now reported configuring three matching GitHub Actions repository variables; the next stable full build must verify enabled presence.

## Current unprivileged change
- Enforce exact SHA/ref, Scratch Preview backend, and presence of GIPHY/PostHog browser-public variables for #592 stable canary before CI compilation; print only feature presence. Do not weaken normal feature branches. Never copy Vercel write tokens, Appwrite administrator keys or PostHog personal API keys into CI.
- Scoped tests cover missing/invalid public feature inputs, wrong Scratch/Production project and source mismatch. Leave existing Git-triggered Vercel Previews unchanged until replacement passes canary.

## Trusted receiver read-only gate (P2)
- Pure default-main receiver validator now checks the exact trusted main checkout, latest successful official same-suite push Quality Gate at the branch HEAD, correct run attempt, and one nonexpired, bounded CI artifact for the same SHA/run/attempt.
- Nondeployable CI manifest includes Scratch/Preview, Node 24 and nonempty GIPHY/PostHog feature presence; receiver rejects any mismatch, unknown v3 route hash or #784 blocking budget overrun. This is only a preflight; actual artifact bytes must still be independently validated before a provider request.
- No GitHub/Vercel write token or provider deployment is touched by this slice.

## Next action
- Focused task CI, squash into stable Preview branch, verify canonical SUCCESS, public feature-presence logs and exact Vercel READY. Presence does not prove copied values equal hosted values.
- Next: trusted default-main receiver update via separately approved infrastructure-only main PR, full canonical/SHA/attempt checks and artifact verification before any provider creation. Canary red=zero new Vercel deployments, green=one, stale/retry=none; verify routing/alias/Scratch and rollback. No routine GitHub approvals after rollout.
- #592 remains OPEN. #784 scheduled-audit acceptance separate.
