# E2EE owner-private v2 contract candidate — source only

Tracking: #1662 / #2084. DO NOT deploy or enable. Synthetic Scratch-project-pinned client codec and UNWIRED prospective Function validator.

The isolated e2ee_owner_v1 Function requires plaintext routing.visibility, date and reminders; the dev privacy manifest encrypts them. Old v1 must stay unchanged and readable.

V2 restricts to eight personal owner collections; no chat, recipients, sharing or public fields. Client requires private visibility where applicable. The server validates only owner/project, envelope shape and minimized routing and cannot infer a hidden visibility value.

The v2 header schemaVersion and policy are additionally authenticated by the AES-GCM additional data (ownerPolicy, ownerPolicyVersion); v1 ciphertext cannot be reinterpreted as v2. Client and server mirrored allowlists are tested against current dev fieldManifest.

No live route, schema or Appwrite mutation. Before any release: dedicated v2 authenticated Function endpoint, per-user owner-only ACL, independent root/key epoch and CAS readback, v1-v2 dual-read migration, old writer fence, owner-state gate, browser/device tests and explicit approvals. Normal sync and Production unchanged.

## Distinct v2 Scratch-only table contract (unregistered)

The candidate `appwrite-functions/message-action/e2ee-owner-v2-schema.js` exports a frozen v2 schema requiring exact isolated project `6b00671500279e901846`, a **separate** `private_owner_ciphertexts_v2` table, empty table permissions and rowSecurity true. It stores opaque row ID, collection, owner/account key epoch, version, ciphertext envelope, minimized routing and server timestamps/sequence metadata; no raw title, date, reminder, visibility, workout stats, MIME, recipient or message fields. Indexed change feeds use only owner/collection/server updated timestamp. The candidate is **not registered** in `infrastructure/mosaic-backend.mjs` or the default migrator, not provisioned and not a valid backdoor into Production. A future reviewed additive migration and actual project-scoped readback must precede Function v2 write implementation, cross-version data migration, and replay/ACL acceptance.

## 2026-11-26 prospective V2 Function server writer — OFF and UNWIRED

The separate `e2ee-owner-v2-candidate.js` now stages one typed `put` operation **against only the distinct unprovisioned v2 table**, with exact isolated Scratch Function-project pin, a *new absent/default-off* `MOSAIC_E2EE_OWNER_V2_ENABLED` flag, an independently narrow owner allowlist, completed MFA session requirement supplied as an explicit **trusted, verified function capability**, with no default authorizer and a hard 401 if absent (the isolated pilot verifier does not exist on current-dev ancestry), fixed v2 policy validator and exact `opId`/revision/generation. It verifies the existing owner-root envelope, key ID, generation and owner before every candidate write; creation uses owner-only row read permission, no client write grants, and conflicting retry/update uses owner/domain/key/epoch/revision compare-and-swap. Tests use an explicit synthetic verifier substitution and mocked database only. There is **no import in active Function dispatch, no v2 environment variable configured, no v2 table, and no backend mutation.** The server cannot independently authenticate encrypted visibility or infer account-wide sealed/migration state from record ciphertext; a dedicated owner-only fenced state machine, root-rotation concurrency control, disclosure model and exact signed release are still mandatory before wiring this candidate. No production-grade secure sync, change feed, old-client export or historical data migration is claimed.

Current-dev does NOT contain the Scratch-only `e2ee-pilot.js` verifier. The candidate explicitly rejects absent/malformed `verifySession`. A future signed Scratch Function port must supply an independently reviewed, project-pinned real account MFA/session verifier (not a synthetic stub), while all current handler tests deliberately inject synthetic verification. No real Function is wired or enabled.
