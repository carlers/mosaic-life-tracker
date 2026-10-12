# Session checkpoint

Updated: 2026-10-12
Current task: Mosaic issue #656 first-open lazy sheets, approved task implementation through Scratch stable Preview; dev/main promotion remains prohibited without separate user authorization.

## Exact refs
- Source `dev@f918b7353d05fb1d4abfdd5452f60a0e0d1db2a1`, v0.19.4. #640 idle-prefetched Day View is accepted and preserved.
- Stable Preview branch `perf/first-open-sheets-656-20261012`, current pre-repair `ff5fb8cd595104661824fabcf08709196c8b0783`, version candidate v0.19.5. Current task branch `chatgpt/656-core-batch-a` derived from stable.
- Related squash PRs: #661, #663, #664, #665, #667, each with CI/deployment provenance.

## Implemented scope for first verified Preview
- `src/lib/createPreloadedLazy.tsx`: cache the module's resolved React component; mounting after warmup avoids uninitialized `React.lazy` first-render suspension. Pin chosen component per mount, preserve cold-demand path and rejected import retries.
- `ChatPage.tsx`, `MessageComposer.tsx`: code-only delayed warmup after Chat is usable; pointer/keyboard/mouse intent hints; first sticker opening uses cached resolved component. No hidden sticker hooks mounted.
- `NotificationsPage.tsx`: code-only warmup after a user-scoped feed hydrates, pointer/mouse/focus hints and resolved friend-day sheet without a blank first commit. No remote data requests during preload.
- Unit/DOM regressions for warm-component synchronous first commit, cold-load path, rejected-import retry and composer pointer/focus.
- **Intentionally deferred**: Home friend-carousel preferences, friend Calendar day, nested Task Share/Link sheet, and all intentional visible-loading paths pending measured second batch. This final scope correction restores `HomePage.tsx` byte-for-byte to dev to protect existing Day View first-open performance and extremely narrow Home/GIPHY closure budget. `PersonCarousel` already matches dev. Do not claim deferred work shipped.
- All seven existing size limits remain unchanged, GIPHY and Appwrite backend config unchanged.

## Verification and previous failures
- Task focused CI for prior fixes successful; previous stable SHA `362d17d3` canonical SUCCESS while Vercel GIPHY-enabled Scratch build failed caps by Home +130, aggregate raw +228, gzip +209, precache +347 bytes.
- Last stable candidate `ff5fb8cd` Vercel GIPHY failed Home closure +52 B, aggregate raw +7 B, gzip +135 B, precache +126 B. This is a hosted size failure even if its GitHub canonical build passes; do not say Preview ready.
- Previously a browser contract intermittently failed in an unrelated category drag test (`interaction-contract.spec.mjs:899`); it passed on other same-feature stable runs. Full green canonical on exact final SHA is mandatory; do not dismiss without proof.
- No private-device warm/cold latency measurement is available. Keep browser/CI and device acceptance distinct.

## Next action
1. On `chatgpt/656-core-batch-a`, restore only `src/pages/HomePage.tsx` to dev, update this checkpoint, run task focused CI.
2. Squash into stable Preview after focused green. Require full canonical GitHub SUCCESS and exact-Git-SHA GIPHY-enabled Scratch Vercel READY, with seven size limits unchanged.
3. Verify stable alias, backend environment and version v0.19.5. Post durable #656 issue checkpoint with evidence, Preview link and remaining second-batch scope.
4. Device acceptance pending: immediately after fresh launch and after idle, Chat sticker and Notifications friend-day first vs repeat open, touch/keyboard/focus/Back/Escape, offline/PWA; ensure owner Day View #640 unchanged. Do not merge to dev/main without authorization.
