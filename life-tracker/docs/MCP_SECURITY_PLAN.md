# Issue #1441 — Scratch-only read-only MCP gateway (disabled candidate)

## Scope and release gate

This is a **fail-closed code foundation**, not a connected MCP integration.
Do not enable it, copy credentials from Production, weaken the existing
`message-action` Function user-execution policy, or promote to `dev` /
`main` until a real OAuth2.1 consent/registration flow and Scratch security
acceptance tests pass. The existing production-bound `appwrite.config.json`
must never be inferred as the Scratch target.

The candidate exposes only `mosaic_list_categories` and
`mosaic_list_tasks`. No MCP task mutation, diary/photo/message/social
access, friend access, or arbitrary Appwrite operations are available.

## Architecture

- Appwrite Cloud **Scratch** in `fra`, project `6a96e82d000d1310b3be`, is
  hard-pinned; other project IDs fail closed. The project OAuth2 server is an
  OAuth2.1/OIDC provider with S256 PKCE, DCR, issuer/JWKS, custom scopes and
  audience-bound access tokens per official Appwrite documentation.
- A Vercel **Preview-only** HTTP resource gateway receives `POST /mcp`,
  backed by `api/mcp.js`. It is disabled unless all exact deployment env
  gates below are present; disabled requests return 404.
- `/.well-known/oauth-protected-resource` advertises the fixed resource
  origin, expected auth server, and `tasks.read` scope. Unauthenticated requests
  to enabled gateway are challenged with WWW-Authenticate.
- Tokens must be signed **access tokens**, not ID tokens or self-asserted user
  IDs. Server verifies RS256 against the fixed project's JWKS, exact issuer,
  exact resource audience, expiration and `tasks.read` scope before any query.
- Server-only key is limited to **rows.read** on Scratch. Each server query
  filters `user_id === verified sub`, `deleted=false`, limit 20; the result
  is additionally checked for owner/deletion consistency. Only an explicit
  task/category field allowlist reaches MCP, never memo, images or secret fields.
- MCP is stateless and **read-only**; no replay-able side effects and no
  user-provided owner ID. The existing account-scoped RxDB bulk writes are
  deliberately *not* exposed externally.

## Required Preview configuration — NOT yet completed

Set only after real consent/UI/security validation:

- `VERCEL_ENV=preview` (provider-owned; not user-configured)
- `MOSAIC_MCP_SCRATCH_ONLY=true`
- `MOSAIC_MCP_PROJECT_ID=6a96e82d000d1310b3be`
- `MOSAIC_MCP_ISSUER=https://fra.cloud.appwrite.io/v1/oauth2/6a96e82d000d1310b3be`
- `MOSAIC_MCP_RESOURCE=https://<fixed-preview-hostname>/mcp`
- `MOSAIC_MCP_READ_KEY=<Scratch rows.read-only server secret>`

Do not store the key in GitHub, the frontend, or chat. Use Vercel scoped
Preview secret storage and revoke/rotate it on suspected compromise.

## Required missing integration and acceptance

1. Implement and test the **Mosaic-hosted OAuth2 consent page**. It must
   require the current Scratch user session, display requesting client, exact
   `tasks.read` scope and requested resource audience, and approve/reject
   the correct pending grant with CSRF/state safety. Preserve login return URL.
2. Enable the OAuth2 server on **Scratch only**, pointing to a stable,
   registered consent-screen HTTPS URL. Validate discovery metadata and DCR
   with the actual ChatGPT client metadata and callback URI, S256 PKCE, and
   resource echo on authorize/token requests.
3. Provision a dedicated minimal-scope Scratch `rows.read` server credential
   into Vercel Preview and configure a stable Preview resource host. Never
   enable against Production.
4. Test missing/expired/forged/wrong-issuer/wrong-audience/no-scope tokens,
   owner swapping, malicious tool arguments, overlong inputs, revoked grants,
   consent rejection, rate limiting, and cross-owner Task/Category results.
   Validate real ChatGPT OAuth connection and revocation on disposable users.
5. Preserve manual Brave/Android model/deletion and two-device task-sync/undo
   acceptance. Keep issue #1441 OPEN until all external and physical tests pass.

Relevant external references: Appwrite OAuth2 server documentation and
Model Context Protocol HTTP authorization specification (2026-07-28), plus
OpenAI Plugin Authentication guide.
