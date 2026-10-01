# Session checkpoint

Updated: 2026-10-02
Current task: Reduce authenticated Home cold-start latency online and offline without weakening local-data, auth, sync, or PWA correctness.
Status: The first pass is accepted on `perf/initial-mount-optimization` and the user reports that startup feels fast. A second low-risk critical-path pass is implemented on `chatgpt/initial-mount-followup`: cached-account database and Home imports begin before the React mount call, all other route behavior is preserved, and the RxDB dev-mode plugin is dynamically imported only in development. The all-collections database readiness boundary remains unchanged.
Next action: Run exact-SHA full canonical verification, squash-promote the follow-up into `perf/initial-mount-optimization`, verify the READY Preview/build output, and compare production bundle output. Runtime phase timings still require a real browser runner; this chat environment cannot execute the hosted Playwright probe because its terminal network has no outbound DNS and no browser-execution connector is exposed.
Blockers: Hosted browser execution is unavailable in this chat; this blocks collecting the startup mark timings, but not the low-risk bootstrap/module-graph optimizations in this pass.

## Accepted first pass
- Startup diagnostics separate RxDB import/create/collection time from Home/provider readiness.
- Closed heavy Home surfaces do not mount at startup.
- Todo/Day View and friend-person code are outside the initial owner-calendar graph.
- Concurrent settings consumers share one legacy-row cleanup.
- The hosted Home chunk fell from about 205 KB raw to about 54 KB raw.

## Follow-up implemented
- Cached authenticated reloads start database bootstrap before `createRoot().render()` rather than immediately after it.
- The Home chunk preload starts in the same bootstrap task and is shared with the later AuthProvider preload path.
- Logged-out `/login` still defers RxDB work until after first paint.
- RxDB's dev-mode plugin is no longer a static production import; development still loads and registers it before database creation.
- No database schema, collection-readiness, sync, account-isolation, or UI behavior contract changed.

## Verification
- Existing offline-startup/browser contracts remain the acceptance layer for cached-account and logged-out startup behavior.
- Full canonical verification is requested by the final follow-up checkpoint commit.
- Stable Preview deployment/build verification remains pending promotion.
