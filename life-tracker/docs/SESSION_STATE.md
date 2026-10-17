# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 cold cached Home critical bundle dependency analysis.

## Boundaries
- Stable v0.29.6 Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: canonical #39013268008 SUCCESS, trusted Preview #39013382108 READY. No dev/main/1.0 promotion; user physical-device acceptance pending.
- Isolated diagnostic branch `chatgpt/858-bundle-dependency-audit-20261017` has **no committed runtime code changes**. CI patches Vite config only inside ephemeral runner, enabling built-in Rolldown module analyzer; no real Appwrite accounts, no backend changes.

## Verified experiments and source diagnosis
- Existing v0.29.6 already verifies Appwrite in background. Controlled uncached network bottleneck is code download (~79 JS files, ~457 KB) and AppDataShell module graph; local DB open ~60–80ms. Service-worker-controlled repeat Home ~0.6–0.7s.
- [SW registration and Auth-route splits](https://github.com/carlers/mosaic-life-tracker/issues/858#issuecomment-6231645081): insufficient/worse performance; rejected.
- [HTML early `import()` lab #39017677504](https://github.com/carlers/mosaic-life-tracker/actions/runs/39017677504): Home ready ~323ms earlier, first paint not improved, unsafe speculative evaluation.
- [Neighbor speculative route preload lab #39018084785](https://github.com/carlers/mosaic-life-tracker/actions/runs/39018084785): suppressing Explore preload only ~115ms cold Home gain.
- [Entries-aware Rolldown chunk grouping #39018397782](https://github.com/carlers/mosaic-life-tracker/actions/runs/39018397782): worsened Home by 92ms; +1 network JS request and +14.7KB app gzip. Rejected.
- [Parser-injected passive modulepreload lab #39019149536](https://github.com/carlers/mosaic-life-tracker/actions/runs/39019149536): baseline Home 5717ms, preload RxDB alone 6224ms, all three 6317ms. First paint baseline 1916ms, DB 3044ms, all 3276ms. Preload not shipped, this CI-only dist mutation bypasses SW correctness; reject. Diagnostic code-only branch not promoted.

## Next action
- Generate per-module production bundle report through Rolldown's built-in experimental `bundleAnalyzerPlugin({format:'md'})` in isolated CI, including largest original modules and static-closure dependency chains. Identify one **specific, truly noncritical** large import in Home/entry graph that can be safely moved behind user interaction or post-owner-Home readiness without dropping function or duplicating data.
- Test one source-level dynamic boundary on a new task branch with real Home/Login and offline PWA browser checks, then if a material improvement is independently verified, stamp the next PATCH Preview version and follow focused/full canonical/trusted READY sequence. Never change account/DB authority, fake cached task data, weaken PWA coverage, or promote dev/main/1.0 without owner approval.
