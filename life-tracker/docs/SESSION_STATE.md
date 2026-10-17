# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 online/offline installed-PWA startup comparison (diagnostic only).

## Live baseline / boundary

- Stable `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`: v0.29.6, full canonical Quality Gate #39013268008 SUCCESS, trusted Scratch Preview #39013382108 READY. Dev remains v0.29.5, Production main v0.29.1. No dev/main/1.0 promotion approved.
- Owner's long pre-Home "Opening your local data…" splash was reproduced with Appwrite permanently unresolved. Under a slow uncached site asset connection Home owner data took ~5.7s; under a previously installed, controlled SW cache ~0.65–0.70s. Those two differ in **asset-cache state**, not online/offline network state.
- Previous structural tests rejected initial SW registration deferral, lazy Auth routes, and unconditional removal of adjacent Explore preload due to negligible Home gains or other regressions. Do not ship speculative import/bundle changes on these findings.

## Experiment

- Isolated `chatgpt/858-offline-online-pwa-20261017` changes only the credential-free production-output Chromium diagnostic, enabling **same installed/controlled precache state** in slow-online and fully offline reload conditions with Appwrite requests held unresolved. It records FCP, local owner Home readiness, DB and shell marks, cache transfer, and navigator online status; four interleaved samples per condition, plus existing uncached controls.
- No app runtime, schema, worker, Vercel, Appwrite project, or customer data changes. This is a synthetic owner with empty local RxDB on Chromium, not a real device, authenticated Scratch account or cold process.

## Next action

- Check exact task SHA focused Quality Gate and isolated #858 lab; inspect any failure and repair. Report direct offline/online results with uncertainty and do not infer causation from uncached comparisons. #858 remains OPEN for owner installed-device/offline acceptance; #936 privacy audit and #914 compatibility gate remain separate mandatory pre-1.0 work. No protected-branch promotion without explicit approval.
