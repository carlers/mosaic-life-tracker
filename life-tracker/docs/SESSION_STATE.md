# Session checkpoint

Updated: 2026-10-14
Current task: #592 — first real protected prebuilt Preview upload.

## Verified prerequisites
- Protected main `67b444ae421bd51c5a0b5869f123bf7124a8d1c3`, [Quality Gate #38519174176](https://github.com/carlers/mosaic-life-tracker/actions/runs/38519174176) SUCCESS, matching Production deployment READY, v0.17.4 unchanged. GitHub ruleset #24880070 ACTIVE with ZERO bypass actors. Dev `f3d9558f` v0.23.4 unchanged.
- Corrected canary `fix/592-trusted-archive-20261014@bb07752c1c04dde17ffa1f4acafafc52f3e8039c` uses exact literal canary=false and disjoint positive fix allowlist, preserving main/dev/other stable branches.
- TWO independent canonical-green pushes [#38520128515](https://github.com/carlers/mosaic-life-tracker/actions/runs/38520128515) and [#38520715903](https://github.com/carlers/mosaic-life-tracker/actions/runs/38520715903) yielded EXACT ZERO Git and CLI Vercel deployments by SHA; both default-main shadow receivers [#38520299678](https://github.com/carlers/mosaic-life-tracker/actions/runs/38520299678) and [#38520891099](https://github.com/carlers/mosaic-life-tracker/actions/runs/38520891099) SUCCESS; prebuilt deploy jobs skipped because creation flag was OFF.
- Root cause of earlier waste: unmatched slash-containing canary defaulted Vercel Git deployments to ON despite '*': false. Existing Node24 regression matches the provider behavior.
- The latest owner message confirms completing the requested repository variable setup; it has NOT yet been observed in a new trusted workflow run. Never expose provider secrets or enable aliases.

## Current task
- Strengthen branch-matching regression to require exact single disabled match on canary and explicitly disabled quiet task branches. No app, route, size budget or provider project change.
- Follow ordinary quiet task focused CI → stable squash → canonical full Quality Gate. Inspect new default-main `Trusted Preview Delivery` and project-scoped Vercel history on that exact stable SHA: before green, zero Git-created Preview; after green, expect exactly ONE protected `--prebuilt --target=preview` CLI deployment READY with SHA/Scratch/GIPHY/PostHog/v3 routing and no other creations. Stable alias must remain OFF.
- If writer is skipped, report the repo variable blocker without assuming it was enabled. If writer fails, inspect failure and provider state before ANY rerun; never create repeated anonymous Vercel deployments.

## Next action
- Verify complete real end-to-end provider proof and no Vercel remote app build; test safe dedupe/stale and rollback. Generalize to ordinary fix/feature categories without disrupting main/dev Git, then one real feature Preview→dev promotion. Keep #592 OPEN until normal workflow satisfies CI-before-provider acceptance.
