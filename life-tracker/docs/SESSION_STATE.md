# Session checkpoint

Updated: 2026-10-20 UTC
Current task: #1027 app-owned Supabase task/category RxDB startup bridge.

## Accepted baseline
- Isolated stable Preview `refactor/1027-three-backend-portability-20261020@8fad9565e72460ed3d1e1da6f488c10e35529ea3`: PR #1071, focused #39394439643 SUCCESS, full #39394632640 SUCCESS, trusted Preview #39394890425 READY at exact SHA; GitHub issue #1027 checkpoint #6286997461.
- Task branch `chatgpt/1027-real-rxdb-core-bootstrap-20261020` is based on accepted baseline; version impact NONE. Existing Appwrite production, Oracle, hosted Supabase, dev/main and user data unchanged.

## Implemented
- `src/lib/supabaseCoreBootstrap.ts` binds the already signed and leased candidate two-domain replication runner to the **actual Mosaic RxDB** database after explicit target/profile, signed owner, local Appwrite writer-stopped callback and server-fence/identity/lease guard prerequisites. Never starts on import and is not called from current Appwrite startup.
- Validates session/credential epoch before and after database bootstrap and after candidate writer start. Rechecks local Appwrite writer suspension after DB ready. On late auth change, cancels begun replication; unconfirmed start/stop blocks the controller from ever silently re-starting.
- `tests/unit/supabaseCoreBootstrap.test.ts` covers the full guarded positive wiring path, unsigned/foreign owner, required local writer stop, mid-bootstrap credential rotation, revived Appwrite writer, concurrent starts, uncertain replication startup/stop, stale handles and post-start auth change cleanup.
- `docs/CORE_MVP_PROVIDER_RETURN.md` distinguishes this app-side data-layer seam from still-missing released provider switching and real backend security controls.

## Verification
- Focused gate at task commit required before stable Preview squash; no test or hosted cloud success asserted in this task yet.

## Next action
- If focused tests fail, repair in one batch, then squash the tested task into new isolated stable Preview and require full canonical CI and trusted Vercel READY for exact stable SHA.
- Next functional gate: actual provider-aware Supabase Auth/context and login/bootstrap activation with *real server-signed* Appwrite owner registry, non-noop local Appwrite stop/old-PWA cutoff, server-enforced single-writer leases, hosted signed security and safe provider-scoped local cursors. Until then no Supabase production provider switch, no stored-user conversion, no dual cloud writers.
- Verify independent forward-and-reverse Appwrite/Oracle/Supabase data replay/DR and multi-device offline convergence. Diary #1029 immediately after usable core release; #1027/#967/#975 open. No dev/main/Production promotion without explicit approval.
