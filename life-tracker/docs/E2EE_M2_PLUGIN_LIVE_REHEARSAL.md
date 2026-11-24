# Isolated E2EE Scratch M2 — plugin-managed Function rehearsal

**Task:** [private Oracle operations #350](https://github.com/carlers/mosaic-server-ops/issues/350), [E2EE milestone #2084](https://github.com/carlers/mosaic-life-tracker/issues/2084).

This documentation-only branch checkpoint creates a fresh, exactly verifiable GitHub
commit for the *existing* E2EE isolated-Scratch Function lifecycle rehearsal.
It intentionally does not change Function runtime files, frontend behavior,
version, schema, credentials, M2 flags, synthetic account, Storage ACLs, or
normal Preview and Production environments. A new exact branch SHA and full
Quality Gate `canonical-acceptance` are required for the root worker to
build a distinct **inactive** deployment from reviewed source.

## Verified baseline before rehearsal

- Only Appwrite Scratch Lab project `6b00671500279e901846`.
- Fixed `message_action` Function, previous active deployment
  `6b043ffac054deb9f87e`, application SHA
  `4109f7ca1d2e3521cb2b685c0531efb83b8cca6e`.
- One existing disposable MFA synthetic account, original M2 HMAC journal,
  original legacy writer seal and private ciphertext Storage bucket
  `private_owner_media_v1`; baseline inventory zero.
- Existing Oracle MCP bridge approved for the exact isolated Scratch-only
  source, with separate protected public M2 and Preview source approvals.
- The new `e2ee_m2_release_probe` live Storage test must pass two random
  binary sizes (17 and 65552 bytes), read back and delete both, with
  zero inventory and no Project/Function change.

## Authorised single-rehearsal actions and stop conditions

The E2EE Function source archive is byte-identical to the pre-test
baseline because this commit changes only this Markdown document. Once
the exact app stable branch SHA and all full push Quality Gate jobs pass,
use the existing connected, peer-verified Mosaic Oracle Operations plugin
with `service=appwrite-scratch-lab` and the fixed operations:

1. `e2ee_m2_release_preflight` with only the new exact SHA and no write;
   poll root HMAC status until `preflight_ready`, with plan digest.
2. `e2ee_m2_release_prepare` with that exact SHA + plan digest and
   explicit confirmation; verify new inactive ready deployment and
   signed receipt before any activation.
3. `e2ee_m2_release_activate` with that exact receipt and separate
   confirmation; independently verify selected Function, original
   owner/MFA restrictions, signed root release journal and phase `active`.
4. `e2ee_m2_release_rollback` with same receipt and separate confirmation;
   verify exact original deployment restored, original signed journal,
   key hashes/legacy writer seal, and zero residual Storage files.
5. Retain exact CI, signed receipts and selected deployment readbacks in
   private Oracle ops issue #350. Do not promote this rehearsal app SHA
   to `dev`, `main`, or Production.

If any stage returns `blocked`, `rollback_required`, a mismatched
selected Function, unknown deployment, unexpected nonempty bucket,
or no exact full CI: **stop; do not retry or reset root journals.**
An activation `queued` result is not a completed release.

The isolated root operator must not expose account IDs, decrypted files,
API credentials, raw failures, arbitrary root commands, or another Appwrite
project to the plugin. The authenticated UI photo roundtrip remains a
separate owner manual acceptance step, not established by this rehearsal.
