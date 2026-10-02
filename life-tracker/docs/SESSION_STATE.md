# Session checkpoint

Updated: 2026-10-02
Current task: Reduce perceived and actual waiting in the PWA app-update path, especially the “Update found — downloading…” phase, without weakening offline-shell coverage or explicit update activation.
Status: Implementation is complete on `chatgpt/pwa-update-download-optimization`, based from stable `perf/pwa-update-optimization`. The first full run passed the production build/PWA check and DOM shards but failed lint because Settings synchronized external PWA state through a React effect. That effect has been removed in favor of derived render state, and the background recheck timer was also aligned so hourly checks are measured from the delayed first attempt. The first repaired full run then exposed a DOM regression in the Settings progress test: a locally discovered ready update was hidden unless the external-store snapshot had already rerendered. Settings now treats either source as ready, keeping the update actionable without reintroducing the linted effect. The next full run passed both DOM shards, both browser shards, the production build/PWA checks, and dependency audit, but its checks job exposed that the new install-wait timer used the browser-only `window` global in the unit environment. The timer now uses `globalThis`, preserving browser behavior while remaining environment-neutral. A follow-up unit synchronization issue also showed that an already-running download did not need any foreground wait at all; manual checks now return immediately as a background download without issuing another `update()` call, and the lifecycle subscription exposes **Update now** when the worker becomes ready. Focused verification is green. The new task tip requests full canonical acceptance. Mosaic now pre-downloads updates after startup, avoids transitive chunk-hash invalidation with Vite's chunk import map, joins an already-installing worker during manual checks, keeps slow installs honest, and exposes **Update now** directly in Settings once ready.
Next action: Wait for exact-SHA canonical acceptance. If green, squash the task PR into `perf/pwa-update-optimization`, verify the stable Vercel Preview, then run an installed-PWA two-build update acceptance check before any promotion to `dev`.
Blockers: None currently. Installed-PWA download-duration and cross-browser import-map behavior still require hosted/manual acceptance; automated tests cover lifecycle transitions and the production build enforces that the emitted import map is non-empty and service-worker precached.

## Completed
- Preserved `registerType: 'prompt'`, `skipWaiting: false`, and `clientsClaim: false`; background acquisition never auto-activates a worker.
- Added delayed/rate-limited background `ServiceWorkerRegistration.update()` checks after startup, with online/visibility guards.
- Manual checks reuse a worker already installing instead of starting another update request.
- Replaced the old 15-second “finish anyway” behavior with an explicit long-running background-download result and a real error for redundant workers.
- Settings turns the update row into **Update now** when the waiting worker is ready; the global prompt remains available elsewhere.
- Audited recent hosted service-worker manifests: a small build transition changed 47 of 97 precache URLs, confirming transitive ESM hash churn as a material update-download cost.
- Enabled Vite's `build.chunkImportMap` cache-stability optimization so a changed dependency does not force transitive importer hashes to change; `importmap.json` is included in the Workbox precache and enforced by the production service-worker check.
- Added unit/DOM regression coverage for background acquisition, joining an active install, slow-install status, and Settings installation handoff.
- Updated §24.13 of `PROJECT_REFERENCE.md` with the acquisition, cache-stability, and lifecycle contracts.

## Verification
- Official Vite documentation identifies hashed import URLs as a cause of cascading cache invalidation and documents `build.chunkImportMap` as the optimization that prevents it. It requires `import.meta.resolve`; current compatibility data shows support from Samsung Internet 20 and Safari/iOS 16.4 onward.
- Official vite-plugin-pwa guidance confirms periodic `registration.update()` checks are supported and recommends guarding offline/installing states; it also documents the sub-one-minute workbox-window heuristic, so Mosaic delays its own first background check beyond one minute.
- MDN confirms `updatefound` means `registration.installing` acquired a new worker and `registration.waiting` represents an installed worker awaiting activation.
- The first full run's build job passed, including chunk-import-map emission and service-worker precache validation; its `checks` job exposed the React effect lint failure described above.
- The first repaired full run exposed the Settings ready-state DOM regression described above; that behavior now has an explicit regression assertion.
- The next full run passed DOM, browser, build/PWA, and dependency jobs; only unit checks failed on the browser-only timer global. That helper now uses `globalThis`.
- The first timer-test repair exposed an unnecessary foreground wait for an already-running install. The production path now reports it immediately as a background download and does not call `registration.update()` again; focused verification for that behavior is green.
- New exact-SHA `[verify:full]` canonical acceptance is pending.
