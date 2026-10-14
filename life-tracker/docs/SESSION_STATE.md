# Session checkpoint

Updated: 2026-10-14
Current task: #592 exact CI build artifact integrity and nondeployable static output.

## Verified start
- dev f3d9558feca499e53c310c5a37be2794717bccf6 (v0.23.4) has accepted #784 2-hard/5-advisory policy and #592 existing non-deployable exact CI artifact producer. Full stable #38433314252 and dev provenance #38433690677 succeeded.
- main f930e30442fe08b9981c29782843521c15e295e0 (v0.17.4) has #784 read-only audit; #592 privileged default-main delivery is still reuse-only shadow, auto Git Preview still happens before canonical acceptance.
- A real #592 artifact from #38433314252 had 161 regular dist files (164 GNU tar entries including directories), no symlinks, correct SHA-256 inventory and exact source SHA. This checkpoint is not permission to deploy its GIPHY-disabled / routing-unverified output.

## Current task scope
- Add strict, bounded, extraction-free GNU/USTAR archive verifier for every retained CI artifact. Check the compressed digest, tar header checksums, safe normalized names, duplicate entries, non-file types, file hashes, complete inventory and exact source ref/SHA. Run it after the existing CI archive creation and before uploading, with unit regression fixtures for traversal, symlinks, duplicates, tampering and unbounded decompression.
- Keep evidence `deploymentAuthorized=false` and no new build, Vercel POST, aliases, credentials, Scratch/Production/backend or app version change. This is a necessary security component, not a finished prebuilt deployment.

## Current follow-up
- Routing packaging adds a pinned official Vercel high-level converter and v3 static routing config to the same CI artifact without another app build or provider request. Configuration remains `deploymentAuthorized=false`; public Scratch/GIPHY build input and trusted recipient are not yet enabled.

## Static output assembly milestone (in review)
- On accepted CI evidence only, copy exact verified dist file bytes into an exclusive, disposable `.vercel/output/static` directory and install the digest-verified v3 `config.json`. The assembly is data-only, no app build, no Vercel credential/request, and explicitly remains `deploymentAuthorized=false`.
- Security regressions test file/hash parity, altered route evidence and source mismatch. Real Preview delivery still requires matching public Scratch/GIPHY effective config, trusted post-canonical main receiver and a protected red/green canary.

## Real canonical build smoke check
- CI now builds output one time and validates exact archive + official v3 routing by actually assembling the 161-file static output in a temporary directory, verifying bytes, then deleting it. No Vercel invocation, API call, alias, secret or second app compilation.
- This is not approval to deploy until accepted Scratch/GIPHY public profile and trusted post-canonical main receiver are proven.

## Exact browser-public CI profile proposal
- The single CI build job now selects approved Scratch public Appwrite project/endpoint/Function when ref is NOT main, and Production only on exact main; runtime checks enforce this. It can optionally consume the owner-mirrored browser-PUBLIC GIPHY and PostHog values from three GitHub repository variables. No Vercel token, private PostHog key, second build or extra provider request.
- The GIPHY and PostHog variables are not verified provisioned. Artifact stays `deploymentAuthorized=false` and should never be used to replace Vercel's Git Preview until exact public profile and trust receiver pass.

## Owner-provisioned browser-public variables: live proof
- Dedicated `#592` stable canary CI job now fails closed before building if GIPHY/PostHog browser-public values are not present, Scratch config is wrong, or source-ref/SHA is inconsistent. Logger emits only enabled/disabled status and no credential bytes. Main Production is separately constrained.
- Use exact stable Quality Gate job log for real proof; repository variables cannot be read by this connected GitHub API. Do not claim byte-equivalence to Vercel's values from presence alone. Artifact remains nondeployable and normal Git delivery remains enabled.

## Next action
- Align effective Scratch/GIPHY public profile; package static build output with Vercel Build Output API v3 and official routing adapter with full deep-link/header tests; use these verified bytes only in trusted main receiver AFTER complete canonical success and source/attempt trust checks.
- Owner separately authorizes accepted dev promotion and later narrowly scoped main infrastructure/configuration change. Test CI-red zero-provider POST, green upload-once, stale/retry/idempotency, stable alias/rollback, one real feature promotion. Keep automatic Git Preview until proven safe.
