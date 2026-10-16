# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #914 Phase A — automated pinned historical client/backend compatibility checks; #889 Production release remains separately gated.

## Verified state
- Protected `dev` remains `d51a9c6af7f67ceecdd88f02783debb45692726b` (v0.29.1); protected `main` remains `bb58300052dc4c85974d97779e2b257ec4f28c7d` (v0.17.4). #909 dev→main PR is open but blocked, no Production promotion.
- #889 authentic Production backup snapshot `20261015T110126518Z` was independently decrypted and strictly restored to isolated DR Appwrite `6ad1074900371036eea5`: owners=6, rows=2924, files=137 exact historical evidence. Owner manually accepted the matching v0.17.4 application and later the migrated 010–015 / dev v0.29.1 app, including the prior 5/8 sync and friends' Diary failures. Current isolated DR has 17 schema tables, dev message-action deployment `6ad1a3c0058ae9c531e8`, and both Function schedules disabled. It intentionally no longer matches old immutable backup after browser writes/migrations.
- There are no known externally installed Mosaic clients: owner controls the known v0.17.4 PWA. An unshipped v0.17.5 one-off hotfix is not required by default, but #889 still needs owner proof of synced/updated/retired old PWA before Production migrations 012–015. Original v0.17.4 strict mapper fails on new Diary/message fields; synthetic bridge was tested but not shipped.

## #914 approved scope
- Add Git-only, backend-change-triggered historical-client source contract gate to canonical `checks`, based on existing `check-scratch-client-compat.mjs`. Derive each pinned client's exact synced subscriptions from its immutable `replicationIds.ts`, reject unsupported/ambiguous sources, preserve outgoing/unknown-field constraints and report exclusions explicitly.
- Policy `config/backend-client-compatibility.json` supports the dev v0.29.1 pre-public integration baseline. Main v0.17.4 is explicitly **pending retirement**, not falsely certified. See `docs/CLIENT_BACKEND_COMPATIBILITY.md`. Phase B live delayed-service-worker/offline fixtures and Phase C capability handshake are deferred until justified.
- Task branch `chatgpt/914-backend-consumer-guard-20261016` from protected dev. Version impact NONE; test/tooling/docs only. No Production, Scratch, isolated DR, Vercel, protected branch or release write authorized by #914.

## Next action
- Verify task's focused CI from an exact coherent commit. Squash task PR into isolated stable `fix/914-backend-consumer-guard-20261016`, check full canonical/Preview. Preserve explicit user approval before any promotion into dev/main.
- #889 still requires owner-only installed PWA transition, target-specific Production migrations and Function activation approvals, real two-account/mobile/offline/PWA acceptance and separately approved dev→main release. DR fix `6147e0b4db38a083439ff8f6520785fe782d735a` remains isolated and is not silently promoted.
