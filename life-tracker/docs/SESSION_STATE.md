# Session checkpoint

Updated: 2026-10-02
Current task: Reduce perceived and actual waiting in the PWA app-update path, especially the “Update found — downloading…” phase, without weakening offline-shell coverage or explicit update activation.
Status: Implementation is on `chatgpt/pwa-update-download-optimization`, based from stable `perf/pwa-update-optimization`. Mosaic now starts a quiet update pre-download only after startup has been settled for more than one minute, rate-limits later checks to hourly, joins an already-installing worker during manual checks, keeps slow installs as background downloads instead of misreporting “up to date”, and exposes **Update now** directly in Settings once a worker is waiting. Focused Quality Gate runs are in progress.
Next action: Resolve any focused CI failures, then make the final `[verify:full]` task commit, wait for exact-SHA canonical acceptance, squash the task PR into `perf/pwa-update-optimization`, verify its Vercel Preview, and run a two-build installed-PWA update acceptance check.
Blockers: None currently. Real download-duration improvement still requires hosted two-build/browser evidence; unit/DOM tests can verify lifecycle state transitions but not network/cache timing on an installed PWA.

## Completed
- Preserved `registerType: 'prompt'`, `skipWaiting: false`, and `clientsClaim: false`; background acquisition never auto-activates a worker.
- Added delayed/rate-limited background `ServiceWorkerRegistration.update()` checks after startup, with online/visibility guards.
- Manual checks reuse a worker already installing instead of starting another update request.
- Replaced the old 15-second “finish anyway” behavior with an explicit long-running background-download result and a real error for redundant workers.
- Settings turns the update row into **Update now** when the waiting worker is ready; the global prompt remains available elsewhere.
- Added unit/DOM regression coverage for background acquisition, joining an active install, slow-install status, and Settings installation handoff.
- Updated §24.13 of `PROJECT_REFERENCE.md` with the new acquisition and lifecycle contract.

## Verification
- Official vite-plugin-pwa guidance confirms periodic `registration.update()` checks are supported and recommends avoiding checks while offline/installing; it also documents the sub-one-minute workbox-window update heuristic, so Mosaic delays its own first background check beyond one minute.
- MDN confirms `updatefound` means `registration.installing` acquired a new worker and `registration.waiting` represents an installed worker awaiting activation.
- Focused GitHub Quality Gate is the active automated verification layer; final acceptance still requires `[verify:full]` on the exact task SHA.
