# Task checkpoint — #854 Scratch-compatible private bug reports
Updated: 2026-11-01 Asia/Manila

- Authorized scope: make private bug reporting testable on Scratch while preserving the active chat-photo Function, independent of dev/main/Production.
- Exact active Scratch Git source before this task: `feature/1460-chat-photos-privacy-v0460-20261101@19c4a716df424b016f87452b19778fb9051bb2b8`. Task branch: `chatgpt/854-scratch-function-compat-20261101`. Bug-report UI remains on `feature/854-private-bug-reports-v0450-20261031`.
- Private `bug_reports` table already exists on disposable Scratch `6a96e82d000d1310b3be` in fra (8 columns, 2 indexes, zero table permissions, row security).
- Forward-port only the server handler, retention, migration, manifest, account-erasure policy and tests. Combined migration ID is `018-bug-reports` to avoid collision with the photo/diary branch's 016/017. Preserve photo source and active Function until exact-SHA CI and inactive deployment are reviewed.
- Complete focused CI, stable integrated Preview canonical CI and Vercel READY. Check active Function source and ID again immediately before Scratch activation; fail closed on concurrent changes. Then verify synthetic authenticated submission, idempotency, private operator retrieval, retention, existing photo and Diary sync. No promotion approved.

---

# Current task: secure chat photo + diary quote privacy Scratch integration
Updated: 2026-11-01 Asia/Manila

- Isolated local integration combines chat photo candidate at 4dabdd4d24e4313bfc1625945e3c80a8f0826343 with Scratch-active #1461 quote privacy at faae41b5bf93e72f4c9b6f8ec75bef720966c4b8.
- Retains both migrations: 016-diary-quote-privacy and 017-message-chat-photos. Local RxDB messages v5 migrates both typed photo metadata and privacy epoch.
- Verified sandbox: TypeScript and production build pass; lint no errors; 1247 unit + 220 Function handler tests pass; historical pinned source contract passes (one published baseline).
- Scratch project 6a96e82d000d1310b3be: optional attachment_type and attachment_file_id columns AVAILABLE; task_images fileSecurity=true, create(users)-only bucket permission. The Scratch Function is concurrently updated by #1461 and must not be replaced with photo-only backend.
- Not yet complete: full canonical CI, inactive Function deployment and activation, hosted ACL proof with three test identities, Android+desktop acceptance, flag-enabled exact-SHA Preview, promotion approvals. No Production/dev/main change authorized.
- Issue https://github.com/carlers/mosaic-life-tracker/issues/1460

---
