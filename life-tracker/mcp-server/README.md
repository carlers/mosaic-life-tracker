# Mosaic MCP Scratch sidecar — issue 1441

This separate Vercel project serves the stateless Streamable HTTP MCP endpoint
at /mcp and the Appwrite OAuth2 grant consent page at /consent.html.
It deliberately never changes the static Output API v3 routes of the Mosaic PWA.

The runtime is disabled unless all checks match: VERCEL_ENV=preview,
MOSAIC_MCP_ENV=scratch, MOSAIC_MCP_PROJECT_ID=6a96e82d000d1310b3be,
MOSAIC_MCP_ENABLED=true, exact MCP_RESOURCE HTTPS Preview URL, and a
server-only MOSAIC_MCP_KEY. No Production Appwrite credentials are accepted.

Bearer access tokens require RS256 JWKS verification, exact Scratch OAuth
issuer and project API audience, current signed expiration and token introspection
(active, not revoked), signed owner subject, and operation-specific scope.
Appwrite issues access-token audiences for its project API, not the RFC8707
resource URI, so the consent page separately checks the request's resource
binding. Only verified owner rows are queried; the tool output explicitly
excludes memos, images, attachments and social data. New single tasks
require tasks.create permission and confirm=true, are owner-private, and use
an idempotency-derived row ID. External bulk requests are proposals only:
the user must enter the command in Mosaic and approve the 20-task capped
typed-confirmation UI before any bulk task changes.

The key must have only rows.read, rows.write, oauth2.introspect on Scratch,
never be committed or returned to browser/API clients. Distinct scopes are
tasks.read, tasks.create, tasks.bulk.propose. Writes have an independent
MOSAIC_MCP_ALLOW_WRITES Preview toggle.

Run npm install, npm test, npm run check and npm run build here. Test real
authorization-code PKCE, consent accept/reject, forged/expired/revoked tokens,
owner isolation and cross-device sync on disposable Scratch accounts before
declaring operational acceptance. Connecting a live ChatGPT OAuth client and
real-device Android/Brave Whisper/Qwen download/deletion require user
interaction. Never promote dev/main/Production without separate approval.
