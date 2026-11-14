# E2EE private-Diary isolated pilot — #1662

**Status: v0.105.0 task-branch candidate; NOT deployed or approved.**

The normal Diary, photos, task/category/bucket-list data, friend projections,
messages and Production remain UNENCRYPTED by this pilot. Do not claim Mosaic
offers E2EE based on the existence of the module or tests.

## Code boundary

- Isolated browser Web Crypto root/record/recovery/device primitives:
  src/lib/crypto/pilotCrypto.ts (AES-256-GCM, 96-bit fresh IV, 128-bit tag,
  HKDF-SHA-256, length-prefixed domain/AAD binding owner/project/row/kid/rev).
- An independent 256-bit recovery key and a nonextractable device-local AES
  wrapper are supported for disposable synthetic tests. A 6-digit PIN is
  **not** implemented; never test such a PIN against a local envelope/hash.
- Isolated IndexedDB store retains only a nonextractable device CryptoKey,
  AEAD-wrapped root, and immutable pending ciphertext intents; no plaintext
  diary draft is stored by this pilot adapter. Existing RxDB Dexie remains
  plaintext and MUST NOT be called locally encrypted.
- New private_diary_ciphertexts and account_crypto_envelopes Git-owned tables
  have table-level permissions [] and row security enabled. Trusted Function
  writes user_id from its authenticated caller only and grants owner row READ
  only. No browser direct CREATE/UPDATE/DELETE permission. Opaque row IDs
  and random revisions/operation IDs support idempotency and CAS; valid
  old-ciphertext rollback is not resolved solely by AES-GCM.
- New /e2ee-pilot page is accessible only against the exact Oracle Scratch
  backend and is not linked into the regular Diary. The server action is
  disabled by default with MOSAIC_E2EE_PILOT_ENABLED=false, and requires an
  explicit comma-separated MOSAIC_E2EE_PILOT_ALLOWED_OWNER_IDS
  allowlist of disposable Scratch Appwrite user IDs. An empty allowlist DENIES
  every account. Never include real account IDs or wildcard entries.
  The feature also requires an exact
  APPWRITE_FUNCTION_PROJECT_ID Scratch guard. Its values must stay disabled
  until the provider admission/MFA and table checks pass.

## Safety gates before a user-testable Preview

1. Run focused tests and canonical gate on exact task/Preview commits,
   including recovery/wrong-key/tamper/owner/CAS tests, TypeScript, backend
   manifest/old-client compatibility, and real artifact size checks.
2. Confirm the current shared Scratch Function deployment and other active
   Preview requirements before migrating new tables or activating any code.
3. Apply ONLY additive migration 026 to Oracle Scratch, with exact target
   readback and no old table permission changes. Run readiness checks.
4. Verify authenticated Function admission rejects a password-only MFA
   session and an unauthenticated/non-owner caller using disposable accounts.
   Client-side MFA checks alone are NOT enough for operator-blind privacy.
5. Activate reviewed Function exact deployment on Scratch ONLY if the above
   prove safe; confirm absent plaintext marker in provider tables/logs and
   that normal Diary, friend and task features remain unaffected.
6. Two-browser/phone recovery using the independent high-entropy key; offline
   queue and retry, missing key/evicted storage, tamper/cross-user, slow
   network, multi-tab/CAS/rollback, account switch/deletion, sync/DR tests.
   Do not invent a passed test or move user data to these tables.
7. Exact-SHA stable security Preview READY and proper origin/PWA check.

## Deferred and blocked

- 6-digit E2EE recovery PIN and spaced PIN reminders require an independently
  reviewed, attested, rollback-resistant, operator-resistant recovery vault.
  Current OCI Ampere A1 and standard Appwrite/KMS are not proof of this.
- Authenticated pairing, local-at-rest encryption, global private Diary cutover,
  phone PWA guarantees, all-data encryption, share keys, messaging ratchets,
  account erasure and DR data migrations remain separate security work.
- Old installed PWAs still write plaintext legacy Diary. Do not encrypt real
  records before a server-enforced no-downgrade/old-writer migration gate.
- A provider can replace served web JavaScript. Neither Web Crypto nor an
  HSM can protect users from a malicious same-origin client script.

## Durable checkpoint

Baseline: dev b8d494754f4e26eec1e4dc5fea3ee85a621b8956 (v0.104.0).
Task branch: chatgpt/1662-e2ee-foundation-pilot-20261114.
Scope: A1/B1 isolated Scratch only; PIN vault B2 deferred; Production untouched.
Plan and blockers: https://github.com/carlers/mosaic-life-tracker/issues/1662
