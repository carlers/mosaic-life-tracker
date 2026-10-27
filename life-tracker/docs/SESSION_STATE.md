# Session checkpoint
Updated: 2026-10-27 Asia/Manila
Current task: #1027 make exact signed local Supabase recovery labs reliable; no release promotion.

## Verified status
- Isolated source `feature/1027-supabase-recovery-20261020@c610db4a56e23d91891df2d7e41a8d4fc84a8764` (PR #1401); image-staging focused CI #40533619545 PASS. Published Docker Hub Supabase PG17 17.6.1.095 linux/amd64 digest `sha256:4c087262afbfbb47da86e2863a52d7e424eb21ab589f732d77eeaab51be8e521` was independently pulled and tagged in all four disposable jobs. Subsequent GHCR `supabase/realtime:v2.78.10` pulls were rate-limited, so GoTrue, eight-/ten-table restores FAILED **before assertions**. Full Quality #40533804221 also failed a separate handoff-size contract (3067/3000); build, DOM/browser shards passed. Do not mark those labs green.
- Latest earlier human-accepted protected Supabase Preview remains immutable `79e83581`; owner passed sign-in, tasks, categories, Diary, Sync Now. No latest deployment. dev/main/Production unchanged.
- True hosted signed six-domain two-owner RLS/CAS `951e8da7665d2cac71a42dfb` PASS with all 12 test rows tombstoned, 0 live. Owner's exact encrypted R2/Fedora original Auth/media restore already accepted; never repeat.
- New Supabase-only empty `portableSettings` RxDB collection exists; six-domain UI/cloud Settings/Bucket sync is NOT enabled, historical Appwrite escrow/old-PWA writer fence and real device/offline/ZIP/photo parity remain unproven.

## Next action
- In four **disposable GitHub CI jobs only**, after verifying the same official digest-pinned PG17 manifest, override the pinned Supabase CLI's GHCR registry preference with `SUPABASE_INTERNAL_IMAGE_REGISTRY=docker.io`, using its documented official Docker Hub image names and existing fixed CLI service tags. Locally tag the verified PG17 image for both registries. No database/version/schema/security-test mutation, token or Production change. Continue to fail closed if any pull or signed recovery assertion fails.
- PR #1402 is merged at `c610db4`; full Quality #40535561292 identified stale unit assertions for the new workflow command/tag, not changed recovery behavior. This task corrects those assertions.
- Focused and canonical acceptance must pass with the unchanged **actual** signed GoTrue, eight-/ten-table and Core App jobs. Resolve environment blockers without bypasses. Then resume original-owner escrow/old-client fencing and fresh-owner Settings/Bucket app integration. No Fedora action due now.

More historical evidence: issue #1027 and associated accepted PRs.
