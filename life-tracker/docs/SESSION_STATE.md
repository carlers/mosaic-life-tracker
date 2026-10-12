# Session checkpoint

Updated: 2026-10-12
Current task: #656 — fix first-open hamburger Menu and friend Calendar Day View; v0.20.4 Preview only, no dev/main promotion.

## #655 dev integration of approved Preview
- Integration base dev@`3b4033767c02917390a16764ab260d949548b9f3` (v0.20.2 category-color preference) and accepted PWA Preview `feature/pwa-progress-655@c132b1841792b2d0315b375d6dc5da5ad2a1325e` (v0.20.1). History diverged; a direct merge would regress version/overwrite unrelated dev fixes.
- New task `chatgpt/pwa-progress-655-dev-combine`, stable integration Preview `feature/pwa-progress-655-dev-integration`. v0.20.3 preserves BOTH feature sets: existing exact category hues and Me > Categories manager, PWA precache progress/push/offline/explicit Update now.
- Frontend/build/docs only. Preserve Scratch Preview vs Production isolation. Verify production/PWA worker policy, tests, all size guards (including hosted GIPHY), preview exact SHA and app version. Original PWA CI `38199613209` SUCCESS and Vercel `dpl_5FYeLtHEDtXhmnEJQnj8sfixgw46` READY. Integration limits initially carry that measured PWA candidate; revise only if exact new combined build requires it.
Next action: combined task build was green; address the compact-checkpoint contract and confirm focused CI, then focused/full CI as required, squash into integration Preview, verify exact-SHA canonical acceptance and Scratch Vercel READY, then merge integration Preview into `dev` via PR using merge commit without version regression. Re-read dev for parallel head movement before promotion. Do not merge to main.

- First stable v0.20.3 Preview `631e2f1672fe6f07b5f46c87d4d29900056c2f29` passed task full production build/PWA policy but exact hosted GIPHY build failed only three asset ceilings (Home +49 B, raw +608 B, precache +431 B). Repair task `chatgpt/pwa-655-integrated-hosted-size` reviews only these measured limits, then focused CI → squash stable Preview → exact canonical CI/hosted READY → dev merge PR.

## Relevant preceding checkpoints (details live on their issues)
- **Category TaskBlock color (v0.20.2, on dev):** Synced Preferences option for Default, unchanged category-text hue, or category border on incomplete Calendar TaskBlocks, including viewed friends. Completed tasks and Day View rows remain unchanged. The prior standalone Preview was `feature/taskblock-incomplete-color-20261012`; preserve all its accepted behavior/tests.
- **Issue #645:** D1 source-intent map and generated D2 component index on an independent Preview; D3 measurement is a separate workstream. Do not merge that Preview implicitly.
- **Issue #640:** User-accepted first-open Day View speed fix already integrated into dev; prior GIPHY-only aggregate size review recorded in #640. Preserve its performance behavior and baseline.

