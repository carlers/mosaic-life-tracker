# E2EE owner-private v2 contract candidate — source only

Tracking: #1662 / #2084. DO NOT deploy or enable. Synthetic Scratch-project-pinned client codec and UNWIRED prospective Function validator.

The isolated e2ee_owner_v1 Function requires plaintext routing.visibility, date and reminders; the dev privacy manifest encrypts them. Old v1 must stay unchanged and readable.

V2 restricts to eight personal owner collections; no chat, recipients, sharing or public fields. Client requires private visibility where applicable. The server validates only owner/project, envelope shape and minimized routing and cannot infer a hidden visibility value.

The v2 header schemaVersion and policy are additionally authenticated by the AES-GCM additional data (ownerPolicy, ownerPolicyVersion); v1 ciphertext cannot be reinterpreted as v2. Client and server mirrored allowlists are tested against current dev fieldManifest.

No live route, schema or Appwrite mutation. Before any release: dedicated v2 authenticated Function endpoint, per-user owner-only ACL, independent root/key epoch and CAS readback, v1-v2 dual-read migration, old writer fence, owner-state gate, browser/device tests and explicit approvals. Normal sync and Production unchanged.

## Distinct v2 Scratch-only table contract (unregistered)

The candidate `appwrite-functions/message-action/e2ee-owner-v2-schema.js` exports a frozen v2 schema requiring exact isolated project `6b00671500279e901846`, a **separate** `private_owner_ciphertexts_v2` table, empty table permissions and rowSecurity true. It stores opaque row ID, collection, owner/account key epoch, version, ciphertext envelope, minimized routing and server timestamps/sequence metadata; no raw title, date, reminder, visibility, workout stats, MIME, recipient or message fields. Indexed change feeds use only owner/collection/server updated timestamp. The candidate is **not registered** in `infrastructure/mosaic-backend.mjs` or the default migrator, not provisioned and not a valid backdoor into Production. A future reviewed additive migration and actual project-scoped readback must precede Function v2 write implementation, cross-version data migration, and replay/ACL acceptance.
