# Session checkpoint

Updated: 2026-10-17 UTC
Current task: #858 Calendar + Todo startup optimization, v0.29.7 Scratch Preview candidate.

## Release boundary

- Accepted stable v0.29.6 `perf/858-startup-diagnostics-20261017@41d196afd557d2e0d499cb9423e196d46e83adf4`, branch remains protected for owner acceptance. New task tree `chatgpt/858-local-mount-prototype-20261017`, PATCH candidate v0.29.7. No dev/main/Production/backend/1.0 approval.
- Source: viewport-proximate Todo drag/drop hooks with 800px overscan; all task content remains rendered, first 12 rows/category and active source registered. Calendar text-only TaskBlocks skip image gate/storage hooks; image-bearing task previews keep their own lazy image hook.
- One manual-only synthetic Calendar/Todo scale workflow stays reproducible; isolated A/B mutation scripts, expired branch-push workflows and duplicate throwaway builds are excluded from deliverable.

## Verified evidence

- Baseline synthetic ephemeral DnD-off vs normal #39036689557: 1000 tasks Todo readiness p50 5306ms normal vs 2104ms without any DnD (breaks reorder, not shipped). Source narrowed to actual row registrations, not Motion alone.
- Combined real-runtime candidate #39042117777 SUCCESS: 60 cached-PWA launches, 0/25/500/1000 real UI-persisted text tasks, offline + slow online, 2x CPU. Online 500 Calendar/Todo 788/1375ms; 1000 897/1863ms. Normal unit/full size and 174-asset PWA policy passed.
- Paired exact baseline vs candidate Calendar TaskBlock #39043046750 SUCCESS: same disposable compiled build; 1000-task Home ready p50 **928→892ms**, first task DOM **999→957ms**, postquery→ready **164→140ms**, n=3. 500-task 821→811ms. At 25 tasks 707→721ms, do not claim universal gain or statistical confidence. Image observers at 1000 text tasks 1001→1; unchanged task-block instances.
- Actual far-scroll 1000th Todo task CDP long press/cancel verified in #39043116013 SUCCESS; 60-launch repeat plus shipped-size PWA budgets passed. Source-level first-drag regression #39042702374 and interaction browser shards on original candidate passed.
- Paired sorted RxDB vs locally sorted hook #39043403886 SUCCESS but no meaningful win (1000 tasks 906 vs 904ms, 500 825 vs 836ms): rejected, no runtime query/sort change. All experiments use synthetic cached owner, Appwrite requests held, Chromium only, not authenticated device claims.

## Next action

- Verify focused tree with version and stripped A/B scripts. Squash into existing stable Preview `perf/858-startup-diagnostics-20261017` through PR (no direct task→dev merge) for full canonical CI and trusted Vercel Scratch Preview READY; check exact version/commit and no production services altered.
- Keep #858 OPEN for owner's real Android/iOS installed-PWA Calendar and Todo fast mount, data/cold launch under slow-online/offline/reconnection, first-gesture drag after scrolling, Diary/share/cross-category, image-heavy tasks, real authenticated Scratch sync and 401 owner revocation. Never claim these device/remote checks completed by synthetic CI.
- Security/privacy #936 and backend compatibility #914 remain independent pre-1.0 blockers. No v1.0 release or dev/main promotion without explicit approval.
