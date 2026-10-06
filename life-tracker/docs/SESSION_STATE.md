# Session checkpoint

Updated: 2026-10-06
Current task: Release Mosaic 0.3.0 from accepted `dev` to `main`.
Status: Sync convergence/reconciliation is promoted to `dev` at `4c88a8aa`; production `message-action` CAS deployment `6ac522c0b2a584dc525e` is active and runtime-smoked. Release prep bumps Mosaic from 0.2.0 to 0.3.0 with no product/runtime behavior changes beyond the already-accepted `dev` tree.
Next action: Verify the 0.3.0 metadata bump, deliver it through a stable Preview, promote the accepted tree back to `dev`, then merge `dev` to `main` and require the full production Quality Gate + Vercel Production deployment.
Blockers: None known.

## Release scope

- Multi-device owner-write CAS for tasks/categories/diary/settings through the trusted Function.
- Bounded visible/online incremental resync for missed Realtime events.
- Manual Sync Now anti-entropy repair for checkpoint-hidden historical local drift.
- Existing accepted TodoMate import/sync performance and workflow hardening already present on `dev`.
- Release version metadata is synchronized in `package.json`, `package-lock.json`, and `src/lib/appVersion.ts`; build identity remains commit-specific.

## Working files

- `package.json`
- `package-lock.json`
- `src/lib/appVersion.ts`
- `tests/unit/appVersion.test.ts`
- `docs/PROJECT_REFERENCE.md`
- `docs/SESSION_STATE.md`
