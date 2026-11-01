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
