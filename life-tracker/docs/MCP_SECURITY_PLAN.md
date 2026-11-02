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

The sidecar uses Vercel native /api/mcp and /api/protected-resource handlers without vercel.json rewrites. A static RFC9728 protected-resource JSON file is published at /.well-known/oauth-protected-resource. The requested OAuth resource is the fixed Preview branch host https://mosaic-mcp-scratch-preview.vercel.app/api/mcp. Sidecar deployment target remains explicitly non-production, with OAuth and API key disabled until signed-token and revocation security acceptance passes. No main/dev/Production or Appwrite configuration changes.
