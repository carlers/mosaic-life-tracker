# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1027 Supabase v0.47.0 private photo rollout and **operator-owned fresh Scratch DR preflight**.

## Live exact verified state
- Isolated stable `feature/1027-supabase-recovery-20261020@7173e1fa78df6e8dcda6ba9caac5244b7cdc3ccf` v0.47.0. `dev@95ecd0b` and `main@319421a` remain Appwrite. Four exact-SHA Quality/Restore/Core App workflows SUCCESS; Core App's two signed private photo tests PASSED. CI artifact SUCCESS, **protected `preview-deploy` waiting for owner approval**; do NOT approve until hosted photo Storage exists and is safe.
- Read-only Supabase management `mosaic-dev` project ref `hcxtiifzxoaflhjgoglb`: PG17, 81 Auth users, 63 task rows, 54 categories, 1 private Diary, **zero Storage objects, zero photo buckets and zero photo RLS policies**. Real stored personal data requires fresh encrypted snapshot and independently verified disposable restore. No hosted schema/data/Storage writes performed.
- Existing age snapshot helper encrypts full PG stream, authenticates ciphertext and inspects TOC. Existing `run-private-core-recovery.sh` originally pinned six old archive counts 81/81/81/49/53/58 and would fail closed on today's 63/54+Diary.
- Current task branch `chatgpt/1027-fresh-photo-restore-preflight-20261023`: strictly **only** an explicitly digest-pinned fresh archive gets dynamic source table row counts and a seventh private Diary COPY, with source-versus-local-PG17 restored row byte comparison. Historical immutable original snapshot keeps six fixed counts. Disposable target adds only the already-hosted Diary schema; no account credentials passed into the recovery wrapper. Guarded React/app/remote schema unaffected. This is NOT complete managed Auth/SMTP/Storage backup/restore.

## Next action and blockers
- Run task focused CI, review diff; merge scoped task PR to isolated stable only after green. Four canonical stable gates/Preview waiting may recur.
- **User action required** on private Fedora terminal: fresh `hosted-encrypted-backup.sh` after database credentials entered only locally, and `run-private-core-recovery.sh --fresh-snapshot-sha256` after unsetting PostgreSQL credentials. Keep age key out of chat/Git. Report only success markers and aggregated counts.
- After operator proofs: independently back up Auth configuration, verify Storage object count still zero, review/apply additive private bucket+RLS+Diary CAS to hosted Scratch only with approved safe gate, prove signed two-owner JWT access denials and restore, then approve protected Preview exact build and manual two-device/photo ZIP/PWA testing.
- User's MVP = all personal features (private task+Diary photos, Bucket List/links, synced settings), defer social only. Full Appwrite history blocked to expected Oct31; early public release relies on clearly disclosed TodoMate/ZIP self-service recovery. Automatic divergence repair and old-PWA writer fencing remain open. Never promote `dev`, `main`, Production or v1.0 without separate explicit approval.
