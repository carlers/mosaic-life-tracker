# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #914 shipped-client policy correction and pre-1.0 upgrade rehearsal preparation.

## Verified production milestone

- Owner-approved PR #909 merged to `main@b952f71ecd2add3172f90104bc0e856a2648ccc9`; exact main Quality Gate #38903977976 SUCCESS including canonical acceptance, matching Vercel Production `dpl_7D3WuWPB2zrFJSpxc2NDSQmyBYEZ` READY, publisher #38904182695 SUCCESS, tag/Release **v0.29.1** targets this exact commit. `dev@f9e01b6fc8f8913b75a9738fc978c0ed55427d98` is the last accepted source. **No 1.0.0 approval or tag.**
- Prior owner-verified Production schema 010–015, active READY `message-action@6ad20d5de9380307809d`, retained READY former deployment, independent key escrow and authenticated DR health. Current live Production Appwrite storage `task_images` has fileSecurity=true and bucket permissions `[create("users")]` (no bucket-wide read).
- Owner reports successful installed v0.29.1 PWA use on both laptop and phone; do not infer specific push, two-account privacy, offline queued-write or old/new SW-delayed compatibility scenarios were individually verified.

## Current scoped implementation

- Source-only #914 compatibility policy now targets **the published v0.29.1 Production merge SHA**, replacing the pre-release pinned source. Old v0.17.4 pending-retirement gate is cleared based on earlier confirmed retirement, **not** certified as backward compatible. The actual historical incompatibility remains documented.
- Add `docs/COMPATIBILITY_REHEARSAL.md`: repeatable disposable old/new live Appwrite + waiting PWA + offline queued-write/privacy checklist, all live acceptance statuses NOT RUN. No schema, Function, Production, Scratch, release or frontend behavior mutation. Version impact NONE.
- Follow `chatgpt/914-shipped-client-baseline-20261016` focused CI → squash into a stable `security/*` Preview → canonical CI and Vercel. No dev/main promotion without separate explicit instruction.

## Next safe actions

- Execute #914 Phase B live testing only on an approved isolated local/Scratch synthetic environment coordinated with #526; document real results. If live constraints prevent proof, record BLOCKED.
- Investigate actual #745 permanent-chat-denial pending behavior and #855 distant-date/#858 slow-network reproducible defects; implement regression-proven critical fixes only.
- #889 owns full 1.0 go/no-go assessment. Version/tag/release **1.0.0 is explicitly prohibited** without detailed owner review and approval.
