# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 isolated Supabase v0.46.0 Sync Now snapshot-consistency fence.

## Verified baseline
- Isolated `feature/1027-supabase-recovery-20261020@701a65ea660e2ee3aaf5ef2f6e07d29d65df06ae` includes v0.46.0 signed three-domain Sync Now progress/owner audit and backend Version labels (#1279/#1280).
- Exact-SHA canonical Quality #39924918077, Synthetic Restore #39924917974 and Real GoTrue #39924917794 SUCCESS. Core App Lab #39924918059 passed its core-app/artifact jobs but the Preview deploy is WAITING for the protected `mosaic-supabase-preview` environment reviewer. No new v0.46.0 READY Preview or manual mobile acceptance was established.
- `dev@95ecd0b1b8ba1e5ec2e1716ae41a63582093721e`, `main@319421a35a19ad43b2c3c253806c65b131c64722` remain on Appwrite. Supabase is isolated, not Production.

## Scoped internal correctness refinement (no new version)
- Task branch `chatgpt/1027-supabase-audit-snapshot-fence-20261023` begins from the exact stable SHA above.
- Previously, owner verification could certify an initial local snapshot after a new offline draft appeared, or certify its last remote page after another device committed a newer CAS. Both are in-flight race windows and cannot safely be interpreted as evidence of equality.
- After existing paginated readback and local comparison, a second owner-filtered RxDB snapshot checks identities and normalized values; a one-row server read after the last seen revision rejects a mid-audit remote change. The account/session epoch remains checked; no data mutation, checkpoint adjustment or cross-owner comparison occurs.
- Unit regressions cover concurrent newly added local data and a later remote CAS, including denial of CAS/create writes. This does **not** add automatic local repair, a linearizable database snapshot, or full Appwrite eight-domain parity.

## Next action
- Run task-focused CI on this scoped change and resolve any actual failures. Preserve original `701a65e` accepted gates and pending protected Preview approval; do not silently replace its deployment subject.
- After approved v0.46.0 Preview acceptance, determine whether a separate stable Preview refinement is warranted, with fresh canonical exact-SHA acceptance and signed/multi-device testing.
- Automatic drift repair still requires persisted pristine/dirty-owner evidence, race-safe CAS/local patch behavior, offline draft preservation, old-PWA/server writer fences, a fresh Appwrite authoritative source and full reversible migration proof. Never infer safe overwrite from a settled RxDB checkpoint alone.
- No `dev`/`main`/Production, hosted SQL, data, Auth, Appwrite writer or provider change is authorized. Keep #1027/#967 open.
