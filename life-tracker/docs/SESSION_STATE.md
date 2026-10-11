# Session checkpoint

Updated: 2026-10-11
Current task: Issue #592 Batch A diagnostics follow-up; no dev/main promotion authorized.

## Verified
- dev remains f65d348c2f537b4d8c1063096e6856a9ee3d629f (v0.17.2), main 614cd1dccbd01bf70493874496559720b320151a.
- Stable Preview feature/workflow-batch-a-592 accepted at 2ba57bc0dcf260c6bd53225c92c09d5dbdffe0c3: canonical CI 38123006068 SUCCESS, Vercel dpl_8WjCco5A3Tqu76KYPniUMrcskXCM READY, Scratch build and size guard passed.
- Vercel config still scopes GIPHY only to dev and sticker Preview branches, not generic Preview or Production. Batch A Preview build explicitly logs disabled.
- Matching source-shipped entry/initial/Home closure counts coexist with aggregate JS/CSS differences; Vercel logs show ChatPage chunk hash/size differences. Exact 2,050-B raw/786-B gzip delta remains incompletely attributed because Vercel Git deployment files API returns 404. No secrets or environment variables have been changed.
- Older budget failures were legitimate guard detections, not proof the bundle was broken. Seven limits remain blocking, unchanged.

## Working set
- Current follow-up task branch chatgpt/workflow-batch-a-diagnostics-592 from stable Preview SHA 2ba57bc0; target stable Preview feature/workflow-batch-a-592.
- Improve build-size diagnostics to account for unmanifested emitted JS/CSS and shared asset deduplication. Regression tests cover orphan emitted chunks and historical notifications-size growth.
- Prior Batch A feature scope comparison and reviewer-record contract remain intact. App version NONE; no Appwrite changes.

- First follow-up Preview d18ba979 emitted an intermittent DOM shard 2 error: SettingsPage feedback timeout fired after test teardown (window undefined). Timer cleanup and a focused unmount regression are in the next task candidate. CI failure was not caused by size diagnostics, but must not be labeled passing.

## Next action
Verify timer-cleanup task focused CI, squash into stable Preview and verify full canonical CI plus exact-SHA Vercel READY. Keep d18ba979's failing canonical run distinguishable from the next accepted SHA. Record unresolved GIPHY generic Preview scope vs dev and Production browser artifact questions in #592. Do not make a service-wide GIPHY scope change or promote dev/main without explicitly reviewed authorization. Reproduce exact source/target build output only when artifacts are accessible.
