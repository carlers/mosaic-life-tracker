# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 structural cold startup: test HTML-dispatched critical import waterfall.

## Boundaries and last accepted state

- Stable Scratch Preview `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4` is v0.29.6, full canonical #39013268008 SUCCESS, trusted READY #39013382108. Real installed-PWA acceptance pending, no dev/main/1.0 promotion authorized.
- Diagnostic experiment branch `chatgpt/858-critical-head-preload-20261017` is built on the stable Preview SHA. No runtime product change is committed by the experiment.
- Prior [Phase A/B checkpoint](https://github.com/carlers/mosaic-life-tracker/issues/858#issuecomment-6231645081): deferring first-install service worker saved ≤111ms but first paint did not improve; lazy Auth route imports worsened Login FCP by ~248ms. Both rejected. Appwrite account verification already runs in background.

## Hypothesis and next action

- On slow uncached Chromium, the main bundle begins executing about **1.8s** after document navigation; only then do RxDB/Home/AppDataShell dynamic imports start. Their JS requests take another ~2.2–3.7s, while actual RxDB open is ~80ms.
- Test a same-runner disposable Vite-built `index.html` module script, conditionally (cached local identity) issuing these imports at HTML parse rather than waiting for the app entry. Inspect Home usable/first paint, Login, transferred bytes, module marks, build and offline contract. All Appwrite requests are held, no real account. Import execution order and account safety require review before shipping.
- If the lab proves material Home improvement without Login regression, turn it into a safe passive-only preload implementation with full tests and versioned stable Preview. If not, reject it and focus on the Home/AppDataShell static request graph. Never show private data before RxDB owner-scoped readiness; preserve all offline chunks and SW explicit update policy.
