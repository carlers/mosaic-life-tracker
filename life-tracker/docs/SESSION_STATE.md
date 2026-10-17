# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 slow-network cached Home critical-path experiments; evaluating passive HTML modulepreloads.

## Verified boundary
- Stable v0.29.6 Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: canonical #39013268008 SUCCESS, trusted Preview #39013382108 READY. No dev/main/1.0 promotion; installed device acceptance pending.
- Diagnostic branch `chatgpt/858-parser-modulepreload-20261017` retains shipped source unchanged. The experiment injects synthetic query-controlled early `<link rel=modulepreload>` into **CI `dist/index.html` only after build**, so SW precache fingerprint of that dist is deliberately invalid; test runs with SW blocked. Do not deploy this artifact.

## Evidence and hypothesis
- [SW/Auth/route lab findings](https://github.com/carlers/mosaic-life-tracker/issues/858#issuecomment-6231645081): no worthwhile gain from SW register scheduling or auth-route splitting.
- [HTML `import()` experiment #39017677504](https://github.com/carlers/mosaic-life-tracker/actions/runs/39017677504) began app-shell code earlier (~1.1s) but gained only ~323ms usable Home and no first paint improvement; speculative execution is unsafe as a shipped mechanism.
- [No neighbor-preload #39018084785](https://github.com/carlers/mosaic-life-tracker/actions/runs/39018084785) ~115ms slow Home gain. [Rolldown entries-aware grouping #39018397782](https://github.com/carlers/mosaic-life-tracker/actions/runs/39018397782) **regressed** slow Home 5634→5726ms, requests 79→80, app gzip +14.7KB; rejected.
- Cold Home downloads ~79 JS resources, ~457KB transferred. Entry ~133KB gzip, RxDB ~130KB, shared Framer module ~39KB. React bootstrap begins ~1.8s, after which DB/app-shell JS load takes ~2–4s.
- Hypothesis: *passive* parser-driven modulepreload for one or more exact Vite hashed Home entry chunks can overlap initial entry download, without executing speculative modules ahead of auth/DB. Compare no preload, only DB, only AppDataShell, only HomePage, and all three at equal production-built assets. Measure Home/data, first paint, network requests, bytes; Appwrite held; first visit only.
- If materially faster, implement the production mechanism *during Vite build* to retain exact SW precache/fingerprints, verify Login unaffected and full Android/iOS PWA offline. If not, reject. No hidden private snapshot or parallel database.

## Next action

- Inspect passive parser-preload A/B results and validate Home-ready, first paint, and Login before any runtime change. If successful, reproduce with a build-stage transform that maintains SW precache correctness and verify full browser/device lifecycle. Otherwise reject, document evidence and continue profiling the actual critical dependency boundary. No dev/main/1.0 promotion.
