# Isolated private-Diary E2EE foundation — issue #1662

**No live E2EE capability is deployed.** This is an isolated cryptographic
foundation and a test harness, not integrated with legacy Diary, active RxDB,
Appwrite, messaging, backups, or a secure PIN recovery service.

Browser Web Crypto generates an independent 256-bit account root, never a
password, TOTP or six-digit PIN. Record ciphertext uses AES-256-GCM with random
96-bit IV, 128-bit tag, domain-separated HKDF-SHA-256 key derivation and
authenticated context (project/owner/row/key epoch/revision/version).
Root envelopes are separately wrapped by a **256-bit independent recovery
secret** (for synthetic prototypes only) or an unexportable browser AES key.
The latter is callable by compromised same-origin JavaScript and **not** hardware
attested. Neither AES-GCM nor the browser key prevents server rollback of
earlier valid ciphertext, database metadata leakage, or old plaintext backups.

No weak numeric-PIN key wrapper or offline PIN verifier is provided. Implement
PIN recovery only after attested rollback-resistant vault feasibility,
independent review, a finite cumulative guess budget and negative tests.

Before a Scratch-dependent Preview, add a new isolated owner-readable
ciphertext table, server/Function-only writes, recovery envelope table,
disposable-account auth/MFA fencing and offline-safe adapter; verify zero
plaintext in remote rows, functions and telemetry. Do not modify the current
Diary create/update sync or migrate user data until an independently approved
legacy PWA no-downgrade gate is implemented.

Controlling plan: https://github.com/carlers/mosaic-life-tracker/issues/1662