# Session checkpoint

Updated: 2026-10-02
Current task: Reduce authenticated Home cold-start latency online and offline without weakening local-data, auth, sync, or PWA correctness.
Status: The first optimization pass is implemented on `chatgpt/initial-mount-optimization`. Startup diagnostics now separate RxDB import/create/collection time from Home/provider readiness. Closed heavy Home surfaces no longer mount at startup, Todo/Day View and friend-person code are outside the initial owner-calendar graph, and concurrent settings consumers share one legacy-row cleanup. The database readiness boundary is intentionally unchanged until hosted timings show that it is still the dominant bottleneck.
Next action: Complete exact-SHA full canonical verification, squash the task branch into `perf/initial-mount-optimization`, verify the READY Preview, run the cached-Home startup probe there, and use those measurements to decide whether a staged RxDB bootstrap is justified.
Blockers: None.

## Implemented
- Added one-shot startup marks for database module import, RxDB creation, collection setup, AppDataShell mount, task/category/settings/friend first emissions, owner-data readiness, carousel readiness, and full local-data readiness.
- Added a diagnostic Playwright startup probe for cached offline Home cold-document and warm-reload timings; it reports measurements without creating a release budget.
- Deferred initial mounting of closed Day View, friend-carousel settings, and category-manager surfaces while preserving normal mounted close behavior after first use.
- Dynamically split Todo List/Day View and friend-person code away from the first owner-calendar render.
- Deduplicated oversized legacy settings-row cleanup across concurrent `useSettings()` subscriptions while preserving retry-on-failure behavior.
- Kept the existing all-collections RxDB readiness gate unchanged pending measurement.

## Verification
- Focused component coverage was updated for deferred/lazy Home surfaces.
- Full canonical verification is requested by this checkpoint commit.
- Hosted Preview timing and installed-device perception remain pending until the stable `perf/*` branch deploys.
