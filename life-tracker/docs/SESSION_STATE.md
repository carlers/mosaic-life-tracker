# Session checkpoint

Updated: 2026-10-10
Current task: implement issue #406 follow-on collaborator categories, drag/copy and owner-granted edits from stable Preview feature/shared-tasks at 8afc36946180172d027a6dd24083d9baec4ff17f. User directly authorized implementation. Candidate version 0.14.2. dev/main and Production unchanged.

## Completed working set
- Owner-controlled per-invitee title and date permissions, default false, with Function transactional membership, friend, revocation, epoch and revision checks.
- Git-owned additive task_shares columns and ordered migration 009; Scratch Preview prepare allowlist updated.
- Recipient personal category assignment via per-membership account-synced Settings (no owner copy); share rows appear inside their category and support drag to category targets / order among received shares; independent personal duplicate; granted global title/date editors in the received share sheet.
- Strict minimal projections and cache; private owner memo/images/categories not copied.
- New handler and placement regression tests; build-size budgets adjusted narrowly for measured growth. Details: docs/SHARED_TASKS.md.

## Next action
- Repair any focused/CI failures; run contracts, TypeScript, build/PWA/size and focused/full checks.
- Commit exact task tree on chatgpt/** with [verify:focused] and PR to feature/shared-tasks only. On focused green, squash; stable Preview canonical and exact-SHA Vercel.
- Before preview acceptance, run migration 009 on **Scratch only**, package exact task SHA Function source, build inactive, review and activate. Reconcile read-only schema/Function and test disposable user auth flows. No Production schema or Function writes.
- Issue #406 remains open; dev/main promotion needs separate approval. Exact phone/mobile gestures and advanced multi-account acceptance cannot be asserted without device proof.
