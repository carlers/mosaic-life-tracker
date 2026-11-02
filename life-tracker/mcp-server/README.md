# Mosaic MCP Scratch sidecar — issue 1441

This separate Vercel project serves the stateless Streamable HTTP MCP endpoint
at /api/mcp and the Appwrite OAuth2 grant consent page at /consent.html.
It deliberately never changes the static Output API v3 routes of the Mosaic PWA.

The runtime is disabled unless all checks match: VERCEL_ENV=preview,
MOSAIC_MCP_ENV=scratch, MOSAIC_MCP_PROJECT_ID=6a96e82d000d1310b3be,
MOSAIC_MCP_ENABLED=true, exact MCP_RESOURCE HTTPS Preview URL, and a
server-only MOSAIC_MCP_KEY. No Production Appwrite credentials are accepted.

Bearer access tokens require RS256 JWKS verification, exact Scratch OAuth
issuer and **the MCP resource URL in both signed JWT and active introspection
audiences**, current signed expiration, matching JWT/introspection jti, active
(not revoked) status, signed owner subject and operation-specific scope.
A token with only the Appwrite project API audience is rejected: grant consent
alone is not proof that the issued token was bound to the MCP resource. Do not
enable the gateway if the provider cannot issue and introspect that audience.
Appwrite's generic access-token documentation illustrates the project API
audience, while its provider also advertises RFC8707 resource indicators.
Whether an actual token carries this exact MCP resource audience still needs
live acceptance. The consent page separately checks the requested resource,
but consent is not a substitute for resource-bound JWT/introspection claims. Only verified owner rows are queried; the tool output explicitly
excludes memos, images, attachments and social data. New single tasks
require tasks.create permission and confirm=true, are owner-private, and use
an idempotency-derived row ID. External bulk requests are proposals only:
the user must enter the command in Mosaic and approve the 20-task capped
typed-confirmation UI before any bulk task changes.

Read-only access requires only rows.read and oauth2.introspect on Scratch. Enabling private task creation additionally requires rows.write plus the independent write toggle. The key must use minimum necessary scopes,
never be committed or returned to browser/API clients. Distinct scopes are
tasks.read, tasks.create, tasks.bulk.propose. Writes have an independent
MOSAIC_MCP_ALLOW_WRITES Preview toggle.

From life-tracker run `npm run test:mcp`. This runs a locked clean sidecar
install, syntax checks, Node security tests, and the consent build. The
focused Quality Gate runs it when MCP source changes, and full Quality Gate
runs it as part of `test:unit`. Test real
authorization-code PKCE, consent accept/reject, forged/expired/revoked tokens,
owner isolation and cross-device sync on disposable Scratch accounts before
declaring operational acceptance. Connecting a live ChatGPT OAuth client and
real-device Android/Brave Whisper/Qwen download/deletion require user
interaction. Never promote dev/main/Production without separate approval.

The native Vercel function is /api/mcp; OAuth discovery is the static fallback file at /.well-known/oauth-protected-resource (Vercel serves this extensionless file as application/octet-stream). On an enabled endpoint, unauthenticated GET/POST sends RFC9728 resource_metadata pointing to /api/protected-resource, a JSON Content-Type function endpoint. No dynamic rewrites or vercel.json are required. The only accepted resource URI is https://mosaic-mcp-scratch-preview.vercel.app/api/mcp, bound to the dedicated preview alias.

### Public CLI OAuth callback and expired-grant recovery

Public CLI clients may register `http://127.0.0.1:<ephemeral-port>/callback` (or localhost/IPv6 loopback) as an OAuth redirect URI under RFC8252. `src/redirect.js` permits this narrow HTTP exception only when the complete callback origin and path match the grant's reviewed registered redirect. Arbitrary external HTTP callbacks and mismatched ports/paths remain rejected. The route's callback query parameters are retained by the verifier.

If the consent screen shows **Grant not found**, do not repeatedly approve the same grant. In the terminal, interrupt the local OAuth checker with Ctrl+C, rerun it to create a new DCR client/PKCE code, and open that *new* authorization URL in the browser with the intended Scratch user signed in. A prior grant cannot be refreshed by reloading the stale consent page. An actual grant's lifecycle cannot be diagnosed from a screenshot alone. Keep MCP and writes disabled until full security acceptance.

### Scratch-only live-introspection preflight (OAuth acceptance)

The disabled gateway has a separate POST `/api/preflight` endpoint for the two-disposable-account acceptance run. This endpoint is active **only** with `MOSAIC_MCP_PREFLIGHT_ENABLED=true`, `MOSAIC_MCP_ENABLED=false`, `MOSAIC_MCP_ALLOW_WRITES=false`, the dedicated Scratch project ID, fixed resource URL, Preview environment and existing sensitive read-only API key. It accepts an `Authorization: Bearer` token, runs the same RS256 resource-bound JWT and live Appwrite introspection routine as the real gateway, and returns only `204` for accepted or `401` for invalid/revoked tokens. It never returns the owner, scopes, tasks, token, or account details and never executes an MCP method. No alternate token acceptance or admin-user impersonation is enabled.

The locally executed `mosaic-scratch-oauth-preflight.mjs` obtains authorized tokens on the Fedora laptop via PKCE, checks `/api/preflight` before and after its own revocation request, and prints only non-sensitive true/false statuses. After both disposable user tests pass, disable `MOSAIC_MCP_PREFLIGHT_ENABLED` before enabling the separate gateway. Even two passing token tests do **not** prove live task isolation: keep the normal gateway disabled until actual separate-account task access tests are complete. Never paste access tokens, passwords, authorization codes or cookies into chat or logs.

### Scratch temporary owner-isolation fixture

Two explicitly disposable Scratch-only OAuth users are assigned one private category and one private task each. All four rows use the `mcp_iso_*` prefix and user-specific `read/update/delete` permissions. The separate, temporary `POST /api/isolation` service returns **only status 204** when canonical OAuth introspection identifies exactly one of those two users **and** owner-scoped TablesDB reads return exactly that user's private category and task on `2026-11-02`, without the other user's fixtures. Failure returns a non-204 status, with no user or task data in the response.

The endpoint is callable only in standalone Scratch Preview with `MOSAIC_MCP_ISOLATION_ENABLED=true`, `MOSAIC_MCP_PREFLIGHT_ENABLED=true`, distinct temporary `MOSAIC_MCP_ISOLATION_USER_A/B` variables, `MOSAIC_MCP_ENABLED=false`, `MOSAIC_MCP_ALLOW_WRITES=false`. It uses `authenticate()` and `createRepository()` unchanged. After acceptance, delete four fixture rows and remove/disable the preflight and isolation env flags; the endpoint must return HTTP 404. It is not an end-user MCP function and does not authorize writes or gateway activation.

## Scratch read-only ChatGPT MCP connection (November 2, 2026)

After owner authorization, the separate Scratch Preview gateway can be activated with `MOSAIC_MCP_ENABLED=true` only on the dedicated `mosaic-mcp-scratch` Vercel project. Keep `MOSAIC_MCP_ALLOW_WRITES=false`, `MOSAIC_MCP_PREFLIGHT_ENABLED=false` and `MOSAIC_MCP_ISOLATION_ENABLED=false`. The Scratch key has only `rows.read` and `oauth2.introspect`, never `rows.write`.

While writes are disabled, MCP `tools/list` advertises only `mosaic_list_categories` and `mosaic_search_tasks`. Dispatch of create and bulk proposal tools fails closed with Unsupported tool, including when manually requested. This keeps the custom ChatGPT connector's tool snapshot strictly read-only during acceptance.

MCP resource URL: `https://mosaic-mcp-scratch-preview.vercel.app/api/mcp`. Unauthenticated GET and POST return HTTP 401 and the RFC9728 resource metadata challenge. Both `/api/protected-resource` and `/.well-known/oauth-protected-resource` must serve JSON metadata; the standard extensionless static file uses sidecar-only `vercel.json` response headers to avoid Vercel's default octet-stream MIME. Do not add rewrites to the Mosaic PWA.

Real ChatGPT plugin tool scanning / OAuth login and owner-visible read testing require a person with custom MCP plugin permissions on ChatGPT web. The local synthetic-user OAuth/JWT, introspection, revocation and owner-isolation tests already passed; they do not substitute for ChatGPT's own MCP negotiation. Keep the integration private, and do not promote it to `dev`, `main` or Production without separate approval.

For the read-only Preview, both RFC9728 dynamic and static metadata advertise **only `tasks.read`**, matching the two exposed tools. The Appwrite OAuth2 server may retain future creation scopes, but this resource does not request them during ChatGPT read-only acceptance. Do not publish broad-scope connections as read-only.

### Scratch client acceptance and diagnostic cleanup — November 2, 2026

The installed ChatGPT `Mosaic MCP Scratch Test` custom plugin successfully read a nonempty, synthetic private category and task from Scratch account A. Explicit filters targeting account B returned empty results. All four synthetic read-acceptance rows were deleted and independently verified absent. This is live client end-to-end **read** acceptance, not Android/device acceptance or a release of creation/bulk features.

The temporary live-introspection `api/preflight.js` and fixture-isolation `api/isolation.js` handlers were deleted after successful test acceptance; only the permanent OAuth verification and MCP handlers remain. Old temporary Preview flags stay disabled; leave `MOSAIC_MCP_ALLOW_WRITES=false` and Scratch API key read-only. Do not merge to `dev`/`main` or touch Production without distinct approval.
