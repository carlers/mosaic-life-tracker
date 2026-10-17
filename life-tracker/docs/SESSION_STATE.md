# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network Home critical-path architecture; test Vite 8 Rolldown chunk grouping without lazy-route overfetch.

## Accepted state and boundaries

- Stable v0.29.6 Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: full canonical #39013268008 SUCCESS, trusted READY #39013382108. Installed-device owner acceptance pending. No dev/main/1.0 promotion.
- `chatgpt/858-rolldown-grouped-20261017` is diagnostic-only and based on stable Preview. It never commits or deploys experimental runtime changes.
- Experiments on same-runner controlled slow network (120 kB/s, 220ms, 2× CPU, Appwrite held): [SW and Auth-route A/B](https://github.com/carlers/mosaic-life-tracker/issues/858#issuecomment-6231645081) rejected. [HTML-first kickoff lab #39017677504](https://github.com/carlers/mosaic-life-tracker/actions/runs/39017677504) moved AppDataShell ready ~1.1s earlier but Home ready only ~323ms earlier; first paint / page wall clock unchanged. [Home-neighbor preload A/B #39018084785](https://github.com/carlers/mosaic-life-tracker/actions/runs/39018084785) showed only ~115ms slow Home benefit when disabling speculative Explore preloads; fast/cached impact ~14–25ms. Neither merits shipping.
- Cold Home graph fetches ~79 JS chunks; many tiny shared UI/sheets modules and long import-dependent request waterfall. RxDB local open ~60–80ms. This suggests structural chunk fragmentation, not remote Appwrite.

## This experiment

- Build and measure paired baseline and experimental Vite/Rolldown production outputs on one CI runner. Candidate uses `build.rolldownOptions.output.codeSplitting.groups` matching shared `src/components, hooks, lib` modules, `entriesAware:true`, bounded maxSize, without recursive dependency capture. Capture Home ready, first paint, JS request counts + transferred bytes (fast/slow/cached PWA), JS/CSS Home closure, all app assets and precache footprint. Synthetic account only, blocked Appwrite.
- Do not ship without material improvement *and* preserving Login performance, lazy-route boundary, module side-effect ordering, full offline precache, and all browser contracts. Vite/Rolldown manual grouping can produce execution-order bugs or extra eager assets; reject if build budget fails, metrics regress, or risk outweighs gain. If experiment disproves this, investigate fine-grained auth/bootstrap imports instead.
