# Session checkpoint

Updated: 2026-10-02
Current task: Reduce authenticated Home cold-start latency online and offline without weakening local-data, auth, sync, or PWA correctness.
Status: The accepted startup optimization is now on `perf/initial-mount-optimization`. The first pass removed closed/heavy Home work from the initial owner-calendar path; the follow-up starts cached-account database and Home imports before the React mount call and keeps the RxDB dev-mode plugin out of the production startup graph. The stable follow-up SHA is `8c724e924f490999eb6de39264c69d6b978bb628`; its Vercel Preview deployment `dpl_B9DAMxG6EreMqnEevxXkVM12TNHs` is READY.
Next action: Run the existing cached-Home startup performance probe in a browser-capable environment and use the phase timings to decide whether the all-collections RxDB readiness boundary is worth changing. Do not stage collections or weaken the single readiness contract without that evidence.
Blockers: This chat environment cannot execute the hosted Playwright probe: the terminal has no outbound DNS and the available browser/deployment connectors do not execute client JavaScript. The connected GitHub surface also does not expose push-triggered Quality Gate run records, so exact canonical-acceptance status cannot be independently observed here.

## Delivered
- Added startup marks that separate RxDB module import, database creation, collection setup, AppDataShell mount, owner task/category readiness, carousel readiness, and full local-data readiness.
- Added a diagnostic cached-Home Playwright probe for cold-document and warm-reload startup timings.
- Removed initial mounting of closed Day View, friend-carousel settings, and category-manager surfaces.
- Split Todo/Day View and friend-person code out of the first owner-calendar graph.
- Deduplicated legacy settings-row cleanup across concurrent settings consumers.
- Cached authenticated reloads now begin database bootstrap and Home chunk preload before `createRoot().render()`.
- AuthProvider reuses the same Home preload promise after live/cross-tab login.
- RxDB dev-mode is dynamically imported only in development.
- Database schema, collection readiness, sync, auth/account isolation, and UI behavior contracts remain unchanged.

## Verification
- The first hosted optimization reduced the lazy Home chunk from about 205 KB raw to about 54 KB raw.
- The stable follow-up Vercel deployment is READY; its configured build command completed successfully, including TypeScript/Vite/PWA/build-size checks.
- Existing offline-startup and browser contracts remain the behavioral acceptance layer for logged-out first render and cached-account local startup.
- The final task commit requested `[verify:full]`, but this connector does not expose push-only GitHub Actions runs; do not claim canonical acceptance was directly observed from this chat.
- Manual installed-PWA perception is not claimed beyond the user's report that the first-pass startup feels fast.
