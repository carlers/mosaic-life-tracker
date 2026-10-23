# Session checkpoint

Updated: 2026-10-23 UTC
Current task: #1029 isolated Supabase v0.45.0 private Diary Preview before manual user testing.

## Source and delivery scope
- Task PR #1275 at `chatgpt/1029-core-diary-preview-v0450-20261023` is based on #1274 signed Diary CAS tests. Isolated stable source originally `feature/1027-supabase-recovery-20261020@dcf685b91645efca2402295d3a20fbc319929e2d`; previously accepted v0.44.1 `core-only` Vercel immutable READY at `https://mosaic-life-tracker-yz0y7gr7h-carls-projects-72516fde.vercel.app`. Do not rebrand it as v0.45.0.
- New candidate v0.45.0 selects `core-diary` strictly inside isolated Supabase build + immutable artifact validator; Appwrite `full`, social/photo/Bucket List disabled in Supabase. Client Diary is private-only with real existing local RxDB domain. App/version lockfiles synchronized.
- Task focused Quality #39906218505 SUCCESS at `02306a20aeda0dc81a0a206af17fede10276fb5b`; verification-only disposable Supabase Core Lab #39906322676 `core-app` SUCCESS (7 core signed tests and 1 real signed Diary UI/second-device/foreign-owner test). Its hosted-artifact job **intentionally rejects** verification branch and preview-deploy skipped; no new v0.45.0 Vercel yet.

## Hosted Diary schema — additive-only delivered
- Owner on trusted Fedora created age-encrypted fresh snapshot of isolated hosted `mosaic-dev` 2026-10-23, verified full encrypted archive and independently restored **403 byte-equal original rows in six allowlisted tables**, excluding original sessions/leases. On the independent loopback-only recovery target, original password sign-in, signed server lease, populated owner reads and foreign-owner RLS denial all PASS. Secret/backup stay private; **NOT_FULL_RECOVERY** of SMTP/managed Auth settings/old writer sessions.
- Live preflight immediately before hosted DDL matched six restored counts exactly: Auth users 81, identities 81, authorities 81, owner revisions 49, tasks 58, categories 53; 0 Storage buckets/objects and no prior Diary schema or CAS.
- Applied two tracked strictly additive migrations to **Supabase `hcxtiifzxoaflhjgoglb` only**: `20261023064235 candidate_private_diary_owner_rls_and_cas_20261023`, `20261023064312 candidate_private_diary_realtime_wakeup_20261023` from repo-owned SQL. Verified postread 0 Diary rows, RLS on, 2 owner policies, 2 authority/revision triggers, no anon SELECT/INSERT/RPC, signed only SELECT/INSERT plus guarded CAS, NO direct signed UPDATE/DELETE, Diary in `supabase_realtime`. Same 81 users/58 tasks/53 categories. Issued PostgREST schema cache reload. No Auth, original rows, photos or Production touched.
- Supabase security advisor after DDL has only 4 intentional signed SECURITY DEFINER CAS/session RPC warnings plus existing leaked-password protection warning. Do not disable deliberate auth-checked RPCs or change Auth security silently.

## Blocker diagnosed and repair
- Exact stable v0.45.0 Quality #39913603105, Core App #39913603123, Synthetic Restore #39913603145 and Real GoTrue Restore #39913603135 were all SUCCESS. However Core App `hosted-preview-artifact` failed: Vite's additional `assertPreviewBackendIsolation` guard still hardcoded the old `core-only` profile, blocking `core-diary` artifact assembly. New repair task `chatgpt/1029-core-diary-preview-build-guard-20261023` admits **only** `core-only`/`core-diary` to the pinned mosaic-dev endpoint and publishable key. Protected artifact stage remains **strictly core-diary** for v0.45.0, Production non-Appwrite remains denied; no gate bypass.

## Next action
- Re-run focused task CI for this updated checkpoint; if green, squash #1275 once into isolated stable feature, with #1274 already included in its source history. Run four canonical exact-SHA Quality / signed Core App / Synthetic Restore / Real GoTrue Restore gates and protected hosted-artifact staging. Diagnose and repair any actual failures without weakening gates.
- Protected GitHub `mosaic-supabase-preview` approval is REQUIRED again for new SHA. Once approved, verify exact immutable Vercel READY target/project/provider/SHA/digest; return the verified new URL only (old v0.44.1 URL not new).
- Hosted live JWT two-owner Diary negative reads and actual mobile two-device/offline testing are **not yet verified**; do not equate local disposable signed CI with hosted signed acceptance. Preserve original Appwrite data, old PWA fencing and reversible migration/backup work for later. No automatic `dev`, `main`, Production promotion or v1.0 release.
