# Session checkpoint

Updated: 2026-10-11
Current task: issue #405, approved private Bucket List MVP. See issue #405 latest Resume checkpoint for cross-chat status.

## Scope and code

- Based on `dev@832fc932`; stable Preview `feature/bucket-list-405` v0.18.0. Main/dev not promoted.
- Private owner-only aspirations separate from tasks/backlogs/friends: title, optional description, achieve with timestamp, reopen (clears timestamp), edit/delete. No images, archive, grouping, target dates or social feed.
- New lazy route /bucket-list from Home/Me; independent RxDB collection and seventh owner-only replication pilot using shared Diary/Category owner-only replication mechanics.
- Appwrite Git manifest and additive migration `010-bucket-list`, CAS allowlist, tombstone GC, owner/account erasure and portable backup v3 (legacy v1/v2 compatible). Regression coverage includes sync mapping, backup, migrations, access isolation, GC and workflow contracts.
- PRs #612, #613, #614, #615 squash-merged to stable Preview.

## Verification and blockers

- Full canonical GitHub [38147386717](https://github.com/carlers/mosaic-life-tracker/actions/runs/38147386717) SUCCESS on stable SHA `284ee316`: TypeScript, 941 unit tests, handlers, DOM, browser, dependencies, PWA and GitHub size guard.
- Exact-SHA Vercel deployment `dpl_9boiSiqQfPVQxyULK69qQZ16wnQM` ERROR: GIPHY-enabled provider build produced 2,414,992 app raw vs 2,414,000 cap, 747,373 gzip vs 746,900, and 2,500,463 precache vs 2,499,500. Entry, initial and Home closure all passed.
- Current repair task `chatgpt/bucket-list-vercel-budget-405-20261011` adds metric-specific reviewed allowances referencing that exact Vercel deployment. First focused run [38147668951](https://github.com/carlers/mosaic-life-tracker/actions/runs/38147668951) failed because this checkpoint exceeded the 3,000-token cap; it is condensed here. Baseline and entry/initial/startup limits unchanged. No shared Vercel GIPHY changes.
- Read-only Scratch project `6a96e82d000d1310b3be`: table `bucket_list_items` missing; existing active Function deployment `6acb0cd8735b3060c9af` belongs to #526 integration. No Appwrite schema/Function deployment/activation, Production write, or dev/main promotion authorized or performed.

## Next action

1. Run focused checks on repair task and fix failures.
2. Squash into stable `feature/bucket-list-405`, rerun full canonical and verify exact SHA Vercel READY + stable alias.
3. Before authenticated feature acceptance, obtain separate shared Scratch rollout authorization (#526), migrate table `010`, deploy/review/activate exact Function, verify backend, CORS/origin, synthetic cross-account/offline behavior. Human iOS/Android/swipe/theme checks are outstanding.
4. No dev/main promotion without explicit user approval. Keep issue #405 open.
