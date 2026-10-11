# Session checkpoint

Updated: 2026-10-11
Current task: Cross-device task photos may appear cropped or fail to load on another device.

## Verified starting state
- Live `dev` snapshot at `832fc93229ccfef619f54a9426c8ffc2dee59282`, version 0.17.4. Task branch: `chatgpt/task-photo-cross-device-render-20261011`; do not edit dev/main without user approval.
- Production Appwrite `task_images` bucket exists, is enabled, allows WebP and per-file security. Do not inspect private user pictures or mutate Production for this frontend fix.
- Task-image references replicate as IDs in the task pilot. `getLocalImageUrl` downloads from Appwrite and caches in IndexedDB. It formerly suppressed a valid network result if cache insertion failed and accepted HTTP 206 as if complete.
- The shared image hook held a failed-null acquisition promise until ref eviction, with no focus/online retry. Owner and friend task-row previews used `object-cover` in fixed 16:9 frames, cropping non-landscape photos. Opened PhotoSwipe already used intrinsic dimensions.
- Exact failing user image/desktop reproduction has not been independently observed.

## Task changes under verification
- Treat 200 as the only complete network image response; caching becomes best effort after successful download.
- Retry failed enabled image reads on connection/focus/visibility wakeup; keep lazy off-screen fetch gating, shared URL deduplication and cleanup.
- Use full-photo containment for task-row previews; leave decorative calendar blocks and full viewer intact.
- Add unit/hook regressions; align v0.17.5 candidate version and project reference contract.
- No Appwrite/schema/Function/Production changes.

## Next action
- Stable Preview at `9262635` passed GitHub canonical run `38149909152` (all shards and acceptance), but Vercel failed strict size budgets by +204 B app assets and +169 B precache (third run). Prior two attempts were +471/+436 and +244/+209. No budgets raised.
- Focused repair from that Preview consolidates image compression error propagation, merges offline-cache/remote-download handling, and adds cached-read-failure fallback and test. Continue task focused CI, squash into same stable Preview, full canonical + Vercel READY. Require phone/desktop live acceptance before dev/main.

## Prior task handoff
The previous session tracked issue #592 same-version main-release CI recovery. Its issue/PR comments and live GitHub status remain the source of truth; this photo fix does not alter that workstream.
