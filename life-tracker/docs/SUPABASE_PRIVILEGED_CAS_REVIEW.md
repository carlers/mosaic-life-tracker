# Privileged Supabase CAS security review — #967 / #1027

Updated: 2026-10-28 Asia/Manila. Source review plus read-only hosted catalog/advisor inspection; this is not independent security approval or Production authorization.

## Hosted surface

The reviewed target is `mosaic-dev` (`hcxtiifzxoaflhjgoglb`). Its six personal tables have RLS enabled, no anonymous SELECT, and no authenticated direct UPDATE/DELETE. The seven authenticated-callable SECURITY DEFINER functions are the task, category, Diary, Settings, Bucket and Bucket-link CAS RPCs plus `mosaic_core_session`. All seven are postgres-owned, have an empty `search_path`, and deny anonymous EXECUTE. Default PUBLIC privileges must remain revoked. Security Advisor still reports these seven intentional privileged entry points; do not suppress the warnings or remove the controls to silence them.

The accepted hosted two-owner run `951e8da7665d2cac71a42dfb` tested six-domain owner reads, foreign exact-ID rejection, direct-write denial, CAS races/stale revisions, lease expiry/freeze/epoch/release and session revocation. Its independent readback found two retired fixture accounts and twelve tombstones, zero live fixture rows. Reuse this proof for its unchanged contracts; it does not cover newer uninstalled migrations.

[Supabase privileged-function guidance](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable) explains the advisor warning.

## Authorization and integrity review

- CAS derives the principal from `auth.uid()`, accepts only fixed fields/types, and updates by principal, document ID and exact server revision. Stale or foreign IDs cannot win. No dynamic SQL is built from caller fields. The change trigger owns revision and server time.
- The task protected-field migration excludes `created_at` and `reactions` from ordinary CAS; a table trigger keeps original creation time immutable and rejects new untrusted reaction state. Client conflict review preserves a changed protected-field draft instead of silently acknowledging omitted values. Initial client creation timestamps are historical metadata, not identity or authorization evidence. Social reaction mutation remains unsupported.
- Settings admits only private portable keys. Profile-image and social preferences are excluded from this sync collection. Bucket links preserve immutable owned target references; the target trigger and foreign keys independently reject missing/foreign/live-to-deleted relationships. Unlink uses a tombstone and does not delete the task.
- Every personal write also requires a signed live Auth session and a current, unexpired authority lease/epoch. Freeze or lease release blocks stale browser writes at the server. Multiple devices share the same authoritative provider, not separate authorities. This does not prove that suspended Appwrite has fenced its old clients.
- Private Storage uses signed owner paths and immutable object IDs, denies public/foreign access, and permits explicit owner deletion. Photo references are not public URLs. A database snapshot alone is not a media backup.

## New candidate source, not yet hosted

Account registry and personal-readiness migrations add self-only signed RPCs, private installation/Mosaic/provider mappings and append-only application audit events. `mosaic_account_status` validates the live Auth session and exact existing server mapping; it accepts only fresh/recovery-pending new-data consent. It cannot link accounts by email, accept a caller-supplied legacy owner, mark history recovered or downgrade pending to fresh. Private tables and trigger functions have no browser grants. Registry-aware restore preserves mapping/installation/consent/audit while excluding sessions and leases.

`mosaic_personal_readiness` checks that signed account and a private release-evidence marker. The marker defaults absent and can only be set by a trusted rollout after schema, signed tests and fourteen-table recovery pass. A browser flag cannot approve it. The marker records reviewed evidence; it is not a cryptographic CI attestation and must not be treated as one.

The hosted project currently lacks these migrations and the category retirement/atomic category-delete additions. The atomic deletion RPC must retain signed principal/lease checks, owned category/task scope, server revisions and tombstones. Review the exact additive diff and rollback snapshot before rollout, then verify changed hosted contracts. Existing source/fixture success is not hosted installation evidence.

The personal-writer follow-up closes a client-only gate: all six INSERT/CAS
triggers now require active verified server enrollment, explicit complete consent,
release evidence and a live writer lease. Restrictive Storage INSERT/DELETE
policies add the same requirement to existing immutable owner-path policies.
`mosaic_candidate_private.has_personal_write_authority()` is SECURITY DEFINER,
has an empty search path, no arguments, anonymous EXECUTE denied, and authenticated
EXECUTE solely for stored policies; the private schema stays outside PostgREST.
It takes shared authority, lease, installation, mapping and account locks. Owner
reads remain available for export. Source review is not independent approval;
signed denial/success/lease-release tests and fourteen-table restoration must
pass before this changed contract is accepted or installed on mosaic-dev.

## Remaining release gates

1. Independent review of the current privileged surface and changed hosted schema, including abuse/rate controls and the trusted administrative evidence-writing path. Keep direct UPDATE/DELETE and anonymous EXECUTE denied.
2. Hosted additive rollout with registry-bearing encrypted recovery and signed verification of changed contracts. No real-user import or historical linking is authorized by new-data consent.
3. Auth leaked-password protection is disabled in the current advisor. [Password protection guidance](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection) must be checked against the selected plan; no paid plan or unsupported security claim is assumed. Custom SMTP, redirect allowlists, password-reset delivery and provider limits require verification. The cloud runner's read-only Management Auth-config request returned HTTP 401; no configuration was changed.
4. Protected Preview/device acceptance and separately approved single-authority cutover. Unavailable Appwrite history stays historical and recovery-pending. Its future return must not overwrite current Supabase data; #1406/#1407 remain the verified-link/reconciliation contracts.

No hosted grants, functions, users, policies or Storage objects were changed during this review. Development/main/Production remain outside this isolated delivery.
