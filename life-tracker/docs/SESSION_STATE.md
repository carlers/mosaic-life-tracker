# Current task: secure chat photo + diary quote privacy Scratch integration
Updated: 2026-11-01 Asia/Manila

- Isolated local integration combines chat photo candidate at 4dabdd4d24e4313bfc1625945e3c80a8f0826343 with Scratch-active #1461 quote privacy at faae41b5bf93e72f4c9b6f8ec75bef720966c4b8.
- Retains both migrations: 016-diary-quote-privacy and 017-message-chat-photos. Local RxDB messages v5 migrates both typed photo metadata and privacy epoch.
- Verified sandbox: TypeScript and production build pass; lint no errors; 1247 unit + 220 Function handler tests pass; historical pinned source contract passes (one published baseline).
- Scratch project 6a96e82d000d1310b3be: optional attachment_type and attachment_file_id columns AVAILABLE; task_images fileSecurity=true, create(users)-only bucket permission. The Scratch Function is concurrently updated by #1461 and must not be replaced with photo-only backend.
- Not yet complete: full canonical CI, inactive Function deployment and activation, hosted ACL proof with three test identities, Android+desktop acceptance, flag-enabled exact-SHA Preview, promotion approvals. No Production/dev/main change authorized.
- Issue https://github.com/carlers/mosaic-life-tracker/issues/1460

---
