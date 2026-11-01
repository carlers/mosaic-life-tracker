# #857 Scratch rebridge after concurrent Function deployment (2026-11-01)

- Read back active Function deployment `6ae6dbd5b77ac0f065e3` (16 source files, ready). Exact 16 archived file Git blob hashes validated. It replaced our earlier Scratch guard and omitted `categories.retired_on` and the CAS legacy delete fence.
- This integration branch preserves the active deployment's **other 15 exact file blobs** without replacing any newer chat photos/bug reports. Only `owner-write-cas.js` is the already focused-green additive `retired_on` and owner-fenced `deleted=true` refusal at Git blob `63bbb9c9f3899a5dc0b1d497f8fd8df6092e117f`.
- Need build and inactive Function deployment and exact active-source preflight before activation; no Production changes. Do not merge into unrelated feature branches or dev/main without reconciliation.

---

# Scratch Function bridge for #857, preserving #1460 runtime (2026-11-01)

- Parent: Git-owned #1460 privacy-preview function source 19c4a716df424b016f87452b19778fb9051bb2b8; archived Scratch deployment `6ae63655cb10b393c5e3` source files match this exact git tree (verified all 15 Git blobs).
- Additive Appwrite owner-write-cas `categories.retired_on` allowlist extension only, retaining all #1460 chat-photo auth/orphan actions and source. Optional remote column already exists on Scratch.
- Branch is a Scratch integration artifact; do NOT substitute it for canonical frontend v0.56.0 stable code or merge #1460 unrelated feature into dev/main. Need focused CI, inactive exact-source deployment, read-back active deployment guard and signed synthetic Scratch verification before activation.

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
