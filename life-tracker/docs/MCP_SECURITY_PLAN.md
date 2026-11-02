# Issue 1441: secure Scratch MCP integration

Runtime: separate life-tracker/mcp-server Vercel project, not Mosaic PWA
static Output API v3, not a new Appwrite Function slot. Original experimental
HTTP routes PR 1630 were reverted PR 1631 after canonical route contract failure.

Scratch authorization server:
https://fra.cloud.appwrite.io/v1/oauth2/6a96e82d000d1310b3be
supports OAuth2.1 S256 PKCE, custom scopes, client registration and JWKS.
Set consent to the separately hosted Mosaic authorization page. The
HTTP MCP resource advertises OAuth Protected Resource Metadata and
validates signed tokens plus live revocation/introspection on every call.
Only owner-scoped rows may be queried or written. Single tasks are private
and idempotent; bulk actions are read-only proposals requiring the existing
in-app typed confirmation. No diary/chat/friend/file/account tools.

Independent Whisper/AI cache deletion and B0–B3 bulk execution remain in
the accepted static Mosaic Preview. No dev/main/Production promotion is
authorized. Physical-device/multi-device acceptance requires user testing.

## Native-route correction (2026-11-02)

The sidecar uses Vercel native /api/mcp and /api/protected-resource handlers without vercel.json rewrites. A static RFC9728 protected-resource JSON file is published at /.well-known/oauth-protected-resource. The requested OAuth resource is the fixed Preview branch host https://mosaic-mcp-scratch-preview.vercel.app/api/mcp. Sidecar deployment target remains explicitly non-production, with the gateway and writes disabled until signed-token and revocation security acceptance passes. Scratch's OAuth2 authorization server and its custom scopes are now enabled, but not connected to live gateway calls. No main/dev/Production or Appwrite configuration changes.

## Token resource acceptance gate (2026-11-02)

Require the exact MCP resource URL in **both** the signed JWT and live Appwrite
introspection audiences. Require standard `jti` equality, the OAuth `at+jwt`
header, issuer, owner, client, expiry, token use and operation scope. A consent
record with the MCP resource but an access token bearing only the project API
audience must fail closed. Live Appwrite resource-indicator behavior has not
been verified because the connected principal cannot create the necessary
Scratch-only API key; leave the gateway and OAuth disabled. This protects against
token substitution from another resource using the same Appwrite issuer.

## Credential-provisioned Preview checkpoint (2026-11-02)

Owner supplied the Scratch-only API key through the dedicated Vercel Preview sensitive environment variable without sharing its value. Sidecar remains disabled. Redeploy and pin the stable Preview alias to the reviewed Git SHA before OAuth activation. Vercel serves the static extensionless RFC9728 fallback as application/octet-stream; use a same-origin /api/protected-resource response with application/json as the advertised challenge URL after activation, while retaining the static fallback. A GET without bearer must challenge rather than return 405. Reproducible sidecar npm lockfile and security tests are required.

## Scratch-only two-owner live task isolation test (2026-11-02)

Both real disposable owners independently passed resource-bound JWT signature and live Appwrite introspection before token revocation, and 401 denial after revocation. An isolated read-only owner-isolation canary exercises the same server authenticated user ID against TablesDB with two synthetic private task/category fixtures; it returns statuses only. This is explicitly opt-in while the regular MCP gateway and writes remain disabled. Delete all test fixture rows and disable test endpoints after successful acceptance. The runtime should not be enabled by merely passing mocked tests. Manual ChatGPT connected-app and physical device acceptance are separately outstanding.
