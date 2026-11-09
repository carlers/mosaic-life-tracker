# Mosaic GitHub Projects Admin MCP — issue #1875

Independent, **Preview-only**, owner-allowlisted Streamable HTTP MCP endpoint hosted in a dedicated Vercel project. It does not share code, credentials, releases, or deployment targets with the Appwrite task-data MCP or the Mosaic PWA.

## Scope

- Owner `carlers`, private personal GitHub Project #1 only.
- `inspect_project_config`: read project fields, items, and GitHub built-in workflows (including enabled state).
- `plan_project_config`: compute an exact-state fingerprint and proposed changes.
- `apply_project_fields`: with `confirm=true` and expected fingerprint only; preserves existing option IDs, rejects drift, and verifies issue membership. No issue/PR mutation.
- `verify_project_config`: read back the configuration.
- No general GraphQL execution, arbitrary project selection, project deletion, workflow deletion, auto-close, branch changes, or production operations.

Initial configuration preserves Status option identities, renames Todo to Backlog, adds Planned / Approved / Verification, and creates Work type, Delivery stage, and Blocked dropdowns if missing. Priority remains authoritative in GitHub issue labels. GitHub does not document a public mutation for enabling/disabling built-in workflows; this MCP reports their actual enabled state but **cannot toggle** them. Never interpret an automatic Done as a release authorization.

## Authentication (two independent OAuth boundaries)

This service is **disabled** without all its Preview-only configuration. The inbound MCP OAuth 2.1 flow uses public-client DCR and PKCE S256 with a per-service 32-byte AES-256-GCM encryption key. It delegates user login to GitHub OAuth, checks the GitHub user is `carlers`, requires GitHub's `project` scope, then issues short-lived, independently encrypted MCP bearer credentials bound to exactly the MCP resource. GitHub OAuth codes are exchanged only at the token endpoint; GitHub enforces their single use. Upstream GitHub access tokens are never accepted as inbound MCP tokens or returned to clients in plaintext. No persistent session database or Appwrite dependency.

Required Vercel **Preview-only** environment variables (all separate from Mosaic's other MCP):
- `MCP_PROJECT_NUMBER=2` for a disposable project first (use the real disposable project number), then `1` after acceptance. Project selection is fixed by server configuration, not tool arguments.
- `MCP_ENABLED=true`
- `MCP_PUBLIC_ORIGIN=https://<stable-preview-origin>` (no trailing path)
- `MCP_ALLOWED_CLIENT_REDIRECT=https://chatgpt.com/connector_platform_oauth_redirect` (legacy callback compatibility; current ChatGPT per-connection `https://chatgpt.com/connector/oauth/{callback_id}` redirects are also accepted, with exact host/path and no queries or fragments)
- `MCP_ENCRYPTION_KEY=<43-character base64url key from 32 random bytes>` — sensitive
- `GITHUB_OAUTH_CLIENT_ID` — from a dedicated GitHub OAuth App
- `GITHUB_OAUTH_CLIENT_SECRET` — sensitive

Set the GitHub OAuth App homepage to the stable Preview origin and **Authorization callback URL** to `https://<stable-preview-origin>/api/oauth/github-callback`. Grant the `project` scope during authorization; ensure GitHub presents the intended `carlers` account. Connect ChatGPT to the MCP `https://<stable-preview-origin>/api/mcp` using OAuth with DCR and a verified exact ChatGPT redirect. ChatGPT's plugin authorization is interactive and cannot be completed by this repository.

`VERCEL_ENV` must be `preview`. No Production activation path exists by design. Keep the Vercel project unlinked or preview-restricted; do not use automatic main/Production deploys. `MCP_PUBLIC_ORIGIN` must be a stable preview alias, not a rotating immutable deployment URL.

Discovery:
- `/.well-known/oauth-authorization-server`
- `/.well-known/oauth-protected-resource`
- `/api/oauth/register`, `/api/oauth/authorize`, `/api/oauth/token`, `/api/oauth/github-callback`
- `/api/mcp`

**ChatGPT plugin registration:** New ChatGPT custom plugins use per-connector callback URIs under `/connector/oauth/{callback_id}`. The DCR registration endpoint permits precisely this ChatGPT host/path format plus the configured legacy callback. It binds the exact chosen redirect to the encrypted registered client ID and verifies it again at authorization and token exchange. Use **OAuth with Dynamic Client Registration**, not API-key auth or a manually registered client ID. ChatGPT requires an HTTPS MCP Server URL ending in `/api/mcp`; this is not the GitHub OAuth App callback URL.

## Test and release

From this package: `npm ci && npm run check && npm test`. GitHub Actions `.github/workflows/github-projects-admin-ci.yml` is scoped to this independent package. Use Mosaic task-branch → stable Preview verification; **no promotion to dev/main or any Production app/service** without separate approval.

Acceptance requires: disabled endpoint 503, unauthenticated enabled endpoint 401 with OAuth resource metadata, registered client and PKCE consent (including rejection of wrong account/scope/resource), read-only GraphQL inspection, disposable-project write/rollback validation (set `MCP_PROJECT_NUMBER` to the independently verified disposable project number for testing), and independent readback of the ten canonical issues. Check GitHub's built-in workflow toggles separately in the UI; no supported API mutation is claimed. If GitHub authorization or provider runtime rejects the OAuth flow, keep `MCP_ENABLED` disabled.

For incident response: disable `MCP_ENABLED` on Vercel (or remove the dedicated GitHub OAuth secret), revoke the dedicated GitHub OAuth authorization, and confirm MCP 503; no other Mosaic integration is affected.
