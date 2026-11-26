# E2EE owner-private v2 contract candidate — source only

Tracking: #1662 / #2084. DO NOT deploy or enable. Synthetic Scratch-project-pinned client codec and UNWIRED prospective Function validator.

The isolated e2ee_owner_v1 Function requires plaintext routing.visibility, date and reminders; the dev privacy manifest encrypts them. Old v1 must stay unchanged and readable.

V2 restricts to eight personal owner collections; no chat, recipients, sharing or public fields. Client requires private visibility where applicable. The server validates only owner/project, envelope shape and minimized routing and cannot infer a hidden visibility value.

The v2 header schemaVersion and policy are additionally authenticated by the AES-GCM additional data (ownerPolicy, ownerPolicyVersion); v1 ciphertext cannot be reinterpreted as v2. Client and server mirrored allowlists are tested against current dev fieldManifest.

No live route, schema or Appwrite mutation. Before any release: dedicated v2 authenticated Function endpoint, per-user owner-only ACL, independent root/key epoch and CAS readback, v1-v2 dual-read migration, old writer fence, owner-state gate, browser/device tests and explicit approvals. Normal sync and Production unchanged.
