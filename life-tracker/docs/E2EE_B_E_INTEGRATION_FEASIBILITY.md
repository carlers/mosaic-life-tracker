# E2EE B–E integration and messaging feasibility gate — 2026-11-25

Tracking: app [#1662](https://github.com/carlers/mosaic-life-tracker/issues/1662), [#2084](https://github.com/carlers/mosaic-life-tracker/issues/2084), [#2085](https://github.com/carlers/mosaic-life-tracker/issues/2085), [#2086](https://github.com/carlers/mosaic-life-tracker/issues/2086), [#2087](https://github.com/carlers/mosaic-life-tracker/issues/2087). **Source-only technical checkpoint. Not a selected protocol, functional encrypted social sync, approved Production release or full-coverage E2EE.**

## Live source reconciliation required

On 2026-11-25, the isolated E2EE stable branch was `6e9e46e84bf1af75a1b8d4091c9ed4f21a391def` (v0.114.11); current `dev` was `fd6b715ea43b46dd741d257b42cefc34e504dd2e`, current `main` was `c4c235094e0987b8234d33a2ee1f1a166cb6b8a4`. GitHub comparison from isolated E2EE to dev reports **diverged**, 82 dev-only and 75 E2EE-only commits, with shared files changed in `appwrite-functions/message-action/`, `infrastructure/mosaic-backend.mjs`, `src/db/{schema,migrations,taskReplicationPilot,categoryReplicationPilot,ownerWriteCas}`, `src/hooks/useDiary.ts`, and `package*.json` (compare response limited to first 300 files). Never wholesale-merge the older E2EE application snapshot into dev.

Forward-port reviewed isolated crypto/keyring/codec and transport modules onto a **fresh exact-dev task branch**, preserving dev's newer Appwrite Function and sync semantics. Maintain the separate isolated E2EE Scratch application+backend for destructive tests; no migration of private data/keys. Reconcile the complete field-level privacy manifest, every writer, source auth, Function route, import/export, old versions and background server consumers before enabling normal sync. Submit a focused CI/PR for each coherent dependency batch, but only one integrated owner UAT after automated whole-app acceptance.

## Long-lived chat protocol shortlist (feasibility, not approval)

**Matrix `@matrix-org/matrix-sdk-crypto-wasm`**: official browser/Node WASM bindings to Rust Matrix Olm/Megolm state machine. Browser entrypoints and indexed storage exist. This library is **crypto only**, not an Appwrite-compatible message system; it requires a correctly specified Matrix-like identity, prekey, to-device events, device verification, persistence, backup, replay controls and server delivery semantics. Sources: https://matrix-org.github.io/matrix-sdk-crypto-wasm/index.html ; https://matrix-org.github.io/matrix-sdk-crypto-wasm/classes/OlmMachine.html ; https://github.com/matrix-org/matrix-sdk-crypto-wasm .

**OpenMLS / browser-capable MLS binding**: OpenMLS implements RFC 9420 group messaging and documents WASM use; upstream posted a 0.9.0 release on 2026-08-25. This does **not** by itself prove a maintained, security-reviewed JS distribution that fits Mosaic's React/Vite PWA, Safari/Brave, persistent IndexedDB, Appwrite transport or multi-account state. Sources: https://book.openmls.tech/user_manual/wasm.html ; https://openmls.tech/ ; https://blog.openmls.tech/posts/2026-08-25-0.9.0-release/ ; https://www.rfc-editor.org/rfc/rfc9420.html .

**HPKE (RFC 9180)**: suitable for separately authenticated recipient/device key distribution and trusted-device root envelopes; it is **not** a full long-lived forward-secure chat session. Never substitute static HPKE messages for a reviewed ratchet/MLS. RFC: https://www.rfc-editor.org/rfc/rfc9180.html .

Do **not** adopt obsolete browser `libsignal-protocol-javascript`, unsupported native `@signalapp/libsignal-client` as a browser runtime, or custom ratchet. No package was selected or installed in this checkpoint.

## Mandatory feasibility experiment before social implementation

1. Pick one maintained, license-compatible, pinned browser distribution and document independent audit provenance/security advisories; run it in **Mosaic's real Vite/Chromium/Firefox/WebKit/PWA build** rather than Node-only unit tests. Measure actual WASM asset size and cold/warm load against existing build budget; no threshold relaxation.
2. Two synthetic users, three devices: authenticated verified identity key binding to exact Appwrite project/account/device/epoch; pinned safety number or independent out-of-band comparison. Substituted, downgraded and rollback keys fail closed; old ciphertext cannot be decrypted by an unauthorized recipient.
3. Encrypt/send/decrypt an initial one-to-one message, resume after reload with locally protected crypto state, recover with verified backup, deliver out of order, duplicate, replay, edit/unsend and attach encrypted media with authenticated manifests. For groups/shares, test group join/leave, rekey, offline recipient and revocation of **future** keys. Past recipient plaintext copies cannot be revoked.
4. Define minimized server-visible member/recipient/thread/timestamps and receipt metadata; no private titles, quotes, message body or sensitive notification text in Appwrite rows, Function logs, push or server-side MCP. Define explicit excluded public/routing fields.
5. An independent crypto/protocol review must approve the actual integration and browser/storage/identity assumptions. Until then, mark the protocol **BLOCKED / NOT SELECTED**, not PASS.

## Durable legacy queue continuation

A source-only patch in the `chatgpt/2084-2085-offline-cutover-hold-20261125` task branch preserves current-client outbox and friendship-command intents after the **exact** signed legacy Function HTTP 409 instead of dropping them. New code cannot repair already installed historical PWA binaries. Real old-controller/version proof and a locally verified encrypted export of every unsent revision **must precede** reconnect to a sealed backend. Its source-only regression tests are not physical historical PWA acceptance. Signed Scratch requires zero legacy rows: historical row-level update/delete ACLs need a distinct reversible disposable backend partition, not new canaries in shared Scratch.

## Release gate and next source work

- B: migrate actual owner-scoped RxDB sync and all protected media through typed encrypted adapters, with recoverable local encrypted export, full writer/ACL closure, per-account client-assisted migration, verified recovery/erasure/DR and owner-visible update-required state.
- C: secure authenticated recipient device directory + independent fingerprint, vetted long-lived protocol, encrypted social/chat/share/notifications, offline queues and revoke/rekey.
- D: one-time verified trusted-device HPKE enrollment and correct compromised-device full rekey; recovery secret remains fallback.
- E: canonical exact-SHA application/Function/ACL/old-PWA/browser/DR/adversarial matrix and independent security review, one consolidated owner UAT after green automation; then separate owner-approved dev/main/Production operations. Current production release operator recovery remains independently blocked in private Ops #253; it is not resolved by this frontend patch.

**Stop** on: insecure/unverified chat protocol, wrong environment, data-loss old PWA, any protected plaintext canary, unlocked root absent, nonrecoverable migration, unreconciled dev drift, failed security gate or unauthorized Production changes.
