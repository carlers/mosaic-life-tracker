# Session checkpoint
Updated: 2026-10-28 Asia/Manila
Current task: #1027 / #1406 safe independent Supabase account start and private identity registry, isolated v0.48.0 candidate.

## Baseline and boundaries
- Started from verified recovery `ababddcee968df3a815b36d96a9d097991c47938`. Live full canonical #40541852789, signed GoTrue #40541852559, Settings #40541852713 and Bucket #40541852967 PASS. Core App #40541852557 core-app and hosted-preview-artifact PASS; preview-deploy WAITING for protected approval. Prior owner-tested Preview remains unchanged.
- Work continues only on isolated recovery. No dev/main merge, Production release, real-user import, Appwrite mutation or protected self-approval. Existing dirty secondary worktree is preserved. Appwrite return is not a launch prerequisite; historical source stays non-authoritative and unresolved history remains pending.

## Changes and checks
- Private versioned Mosaic/provider/installation mapping and audit preserve existing server-issued canonical IDs. Signed self lookup rejects unknown/revoked/foreign associations; no email/metadata linking or public historical claim API. New-data choice is explicit before app writers, with durable fresh/recovery-pending consent and no pending-to-fresh downgrade.
- Settings/Bucket hooks now fence awaited writes, stale callbacks and duplicate-insert recovery across account switch/unmount; owner/identity collisions fail closed. Focused account-mutation 23 tests, Auth/registry 30 tests and account-start/provider/mutation 20 tests passed; typecheck and changed-source lint passed. Node 22 build passed blocking size/PWA checks. Existing advisory size warnings remain.
- Four registry tables require explicit fourteen-table encrypted recovery; older recovery profiles refuse to silently omit identity data. Signed CI fixture compares restored mapping/installation/pending state and exact COPY bytes. Real signed CI and full canonical results for this task are still required. Local exact PostgreSQL Docker pull failed while unpacking with `no space left on device`; no schema or real-user data was touched.

## Next action
- Run task focused CI, signed Core App registry/UI lab and fourteen-table encrypted restore; fix failures, then squash into recovery and require full exact-SHA canonical acceptance. Hosted schema/advisor/backup rollout and protected Preview require their gates before deploying these application bytes.
- Continue actual six-domain lifecycle/Settings/Bucket UI integration, photo/ZIP/offline/device acceptance, trusted historical-owner recovery, SMTP/privacy audit and release packet. #1406 is partially implemented, not closed: trusted recovered-owner claim/import remains absent. See MOSAIC_ACCOUNT_IDENTITY.md. No repeat Fedora/R2 historical drill is requested.
