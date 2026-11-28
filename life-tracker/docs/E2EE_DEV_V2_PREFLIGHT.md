# Scratch-only owner-v2 schema readback preflight — source only

Tracking: #1662 / #2084. Not an executable migration or remotely installed operator.

`scripts/e2ee-owner-v2-preflight.mjs` accepts an injected managed-state request and **issues only GET** against the exact isolated Scratch project `6b00671500279e901846` and `life_tracker`. It requires both existing v1 owner ciphertext and root tables to retain empty browser table permissions, rowSecurity and enabled state, then classifies a separate `private_owner_ciphertexts_v2` as `NOT_PROVISIONED` on 404; it never treats absence as READY. For an existing v2 table, it independently requires exact $id, empty table permissions, rowSecurity true, enabled true, unique column and index sets matching the frozen proposed schema.

The preflight does not create tables, migrate ciphertext, execute a Function, grant permissions, inspect row permissions, validate root/account epochs, test old-writer paths or prove that encrypted sync works. It is source-only, has no stored credentials and no network client or public service entry point. An approved, separately installed backend operator must supply exact-source verified request/auth and perform additive schema changes with a second independent readback. Normal Preview/dev/main/Production remain untouched.
