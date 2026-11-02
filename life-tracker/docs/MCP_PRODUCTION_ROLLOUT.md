# MCP read-only rollout — production gates (#1703)

**Status (2026-11-02): non-Production integration preparation only.** Owner authorized proceeding toward release, subject to strict acceptance checks. The current MCP sidecar remains connected to **Scratch Cloud**, not Production. Public discovery, task writes and user data migration are out of scope.

## Known infrastructure and release boundary

| Boundary | Confirmed evidence | Required next gate |
|---|---|---|
| Scratch MCP | `mosaic-mcp-scratch-preview.vercel.app/api/mcp`, separate Preview project; `tasks.read` only | Keep private, read-only and independently deployable |
| Appwrite Scratch | Frankfurt project `6a96e82d000d1310b3be`, OAuth2 server enabled | Retain as disposable only, no Production secrets/data |
| Appwrite Production | Singapore project `6a9703c50016b37110ff`, OAuth2 server **disabled**, no custom OAuth scopes or consent URL | No activation until separate server/consent/key, tests and rollback are ready |
| Oracle Appwrite (#975) | Migration remains an independent, open process | Verify real OAuth2.1/DCR/JWKS/introspection/revocation parity on target before committing to a host; do not assume Cloud support carries over |
| Source branch | Accepted MCP stable Preview `95c45e1` v0.56.0, dev `fe16f4c` v0.80.2 | Integrate only sidecar source into dev-based stable Preview; never force merge the old v0.56 app tree |
| PWA vs sidecar | PWA static Output API v3 and external Vercel MCP HTTP server are distinct | No PWA API rewrites, no automatic Production MCP activation via PWA main build |

## Required pre-Production engineering

1. **Independent production tenant/issuer.** Refactor hard-coded Scratch-only `server/config.js`, `auth.js`, `repository.js`, consent UI and both static/dynamic RFC9728 metadata so environment selection is bound to an immutable allowlist of **separate** project IDs, regional endpoints, expected resource URLs and actual Vercel deployment targets. Reject cross-environment project, origin, token audience, JWT issuer, token `jti`, owner or scope and refuse missing/malformed configuration. No `MOSAIC_MCP_ALLOW_WRITES=true` Production path in the read-only MVP.
2. **Distinct Production infrastructure.** Provision a dedicated Production-only Vercel project/domain and a distinct production Appwrite API key restricted to `rows.read` and `oauth2.introspect` (never share the Scratch key). Use managed secret storage, no secret fetch/logging. Set the OAuth2 consent URL and registered redirect origins to the **actual** Production resource domain. No blind substitution of Preview URL in tokens.
3. **Provider parity first.** Determine whether the eventual Production backend is Cloud or migrated Oracle (#975). On that exact version/server, verify OAuth2 server toggle, DCR/PKCE S256, JWKS RS256 `at+jwt`, RFC8707 resource audience and active introspection/revocation. If unsupported, do not enable MCP; maintain Scratch connector unchanged.
4. **Security.** Independent review and regression for unauthorized or revoked access, scope omissions, owner-bound row filtering, soft-deletion and visibility, output field allowlists, client consent, logs/error payloads, non-public endpoint discovery, SSRF, open redirects, rate-limits (the current in-process 40/min map is *not* a distributed global quota), payload bounds, and denial of write/bulk attempts. A token from Scratch MUST fail the Production verifier and vice versa.
5. **Data correctness.** External MCP only reads **synced** Appwrite tasks/categories, not unsynced RxDB records; document lag/offline behavior to users. Existing task search returns at most 20 and fetches up to 100 rows; classify `partial` and paginate or narrow before advertising comprehensive search. Respect user deletion and account lifecycle.
6. **Rollout/rollback.** Start with disabled private Production host, positive+negative tests using **consented Production test accounts without real user data copied to Scratch**, explicit opt-in and disconnect/revoke path, Android/desktop checks, outage/compromised-key fail-closed drills, monitoring and quotas, CI/branch provenance. Remove test fixtures. Activate only after exact CI and deployment are accepted; rollback disables MCP and revokes its independent key/consents without changing Mosaic PWA authentication.

## Branch delivery (do not skip)

- New `chatgpt/1703-mcp-readonly-integration-20261102` task branch and `feature/1703-mcp-readonly-integration-preview-20261102` stable Preview start from **current dev v0.80.2**, not the older MCP Preview baseline. Copy the accepted MCP sidecar tree and add its locked test/build scripts, with no PWA user-facing changes. Focused CI → squash to new stable Preview → full canonical CI → exact SHA Vercel READY.
- Before any stable Preview → dev PR, run read-only `promotion:preflight`, including source/deployment evidence and exact dev SHA. Dev PR merge only if the tree and version are safe; rebase into new Preview if dev advances. Dev → main uses its own aggregate release review, canonical acceptance and Production PWA checks. It is *not* a way to activate the separate MCP Production service.
- Production domain, scopes, consent and API keys are separate configuration changes and require explicit readiness evidence. A successful Scratch login is **not** Production acceptance. Keep #1703 open until that evidence exists.

## Observed acceptance before integration

The connected ChatGPT `Mosaic MCP Scratch Test` completed nonempty private category/task reads, foreign-owner query denial, token revocation, and Android device acceptance; synthetic rows and four disposable OAuth helper clients were removed. CI `41470050084` on `95c45e1` succeeded. Do not re-run invasive tests without a concrete defect.

Related: [#1441](https://github.com/carlers/mosaic-life-tracker/issues/1441), [#1703](https://github.com/carlers/mosaic-life-tracker/issues/1703), [#975](https://github.com/carlers/mosaic-life-tracker/issues/975).

## Production release preparation after dev-only MCP integration (November 2, 2026)

A distinct Vercel project `mosaic-mcp-prod` (ID `prj_Mcpr3RHamRixqmWhQ9Sk5i3Kc5Tf`) reserves verified `https://mosaic-mcp-prod.vercel.app`, with SSO protection and **`MOSAIC_MCP_ENABLED=false`**, **`MOSAIC_MCP_PRODUCTION_ENABLED=false`**, **`MOSAIC_MCP_ALLOW_WRITES=false`**. There is no Production key or active MCP deployment. Production Appwrite OAuth2 server remains disabled. These facts are not release acceptance.

A new code-only preparation branch pins both Scratch and Production Cloud regional issuers and resources. Production execution must require an independent **additional** production-enabled flag and writes disabled. JWKS and introspection use the environment-selected immutable issuer, with exact token audience, owner, client ID, jti and scope equality; repository queries use that tenant's endpoint/project. Static OAuth metadata must be generated per *build target* from the pinned tenant rather than copying the Scratch JSON into Production.

The actual launch remains blocked until rigorous negative/synthetic Production-account tests, least-privilege Production key creation, OAuth scopes/consent configuration, production-only monitoring/rate-limits, privacy/opt-in/revoke UX, stable Preview canonical CI, authorized promotion, and independent enabled Production deployment verification. Do not reuse any Scratch secrets or deploy the Production source under a Scratch alias. On failure leave all Production switches false and SSO enabled.

Current production backend remains Appwrite Cloud SG; Oracle TEST is not yet verified as an OAuth2 resource-indicator/introspection provider.
