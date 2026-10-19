# Session checkpoint

Updated: 2026-10-19 UTC
Current task: #967 autonomous genuine signed Supabase Auth local integration smoke test, not a hosted backend switch.

## Boundary
- Exact accepted isolated Supabase Preview source before task: `refactor/967-create-master-transport-20261019@90d4964c3b454696556758f558a0461432f0df76`; full #39185591566 SUCCESS, trusted prebuilt READY #39185753239.
- New `chatgpt/967-local-signed-auth-ci-20261019` task branch from that isolated source. No Mosaic runtime import, Production/Appwrite/provider config change, Auth loosening on hosted `mosaic-dev`, real user data, Git branch promotion or version change.
- Previous autonomous hosted Edge Function probe could invoke Supabase HTTPS but admin Auth account creation failed HTTP 400 validation_failed; a later protected invocation was disallowed. The cloud function was made inert (HTTP 410) at version 5. Fresh hosted database read showed 0 users, 0 candidate tasks/categories. Do not bypass tool controls or resurrect that insecure invocation path.
- Read-only hosted Auth /auth/v1/settings returned anonymous sign-ins disabled and email confirmation required; therefore public self-sign-up alone cannot yield two immediately usable hosted accounts.

## Work
- Add `supabase-poc/signed-local-smoke.mjs` to run genuine Supabase Auth password grants and verified JWT GET /user, owner/foreign positive RLS, spoofed insert denial, denied ordinary UPDATE/DELETE, unauthorized anon actions, duplicate create conflict, two simultaneous same-revision CAS writers, stale/foreign denial and tombstone cursor read.
- Add a dedicated experimental GitHub Actions workflow `.github/workflows/supabase-local-signed-auth.yml` to boot ephemeral **local** Supabase CLI on an isolated runner, copy checked-in candidate migrations, disable confirmation only in local CLI config, run the smoke and destroy it. Source script rejects all URLs except 127.0.0.1/localhost on port 54321.
- Update Supabase evaluation to distinguish local real-signed-Auth proof from hosted real-signed-Auth acceptance. No credentials or service-role keys committed.

## Verification
- Local smoke workflow and focused branch CI pending. If local stack fails startup, debug in runner logs. No claim of real signed HTTP passing until the exact GitHub job exits SUCCESS.
- Remote hosted RLS signed test and two SEC DEFINER advisor warnings remain unresolved. No backend cutover.

## Next action
- Commit workflow with [verify:focused], inspect local signed-Auth integration CI and repair failures. Once focused and local smoke green, squash into a *new* isolated stable Preview for one canonical full CI/trusted Preview delivery, record exact SHA on #967. Do not promote dev/main without distinct approval.
- After local proof, build native RxDB replication push/pull and plan safe hosted two-user validation with an authorized administrative test channel, without disabling production protections. Keep issue #967 OPEN.
