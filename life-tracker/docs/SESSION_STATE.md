# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #889 Production migration scope guard; Production release remains gated.

## Current verified state
- Protected `dev@236993fafc0e14207d156b06535d517f3bec0198` = v0.29.1. #926 CI race fix has merged; postmerge Quality Gate #38884516225 SUCCESS; exact-SHA dev Vercel Preview READY.
- Protected `main@1f146ba7e935a1f2595c176ca21f41413698d2c0` = v0.17.4; Vercel Production READY. #909 pre-1.0 PR OPEN, not accepted for main release. No 1.0.0 authorization.
- Live read-only Production Appwrite check: 14 tables; diary 7 columns, messages 21; old `message-action@6acb8162dc02a1deaa23` active; daily DR Function scheduled. Approved 010–015 migrations and Function upgrade have NOT been executed.
- Owner's old v0.17.4 PWA sync/retirement and current authenticated R2 `dr:check` / independent escrow remain UNVERIFIED. No target-confirmed Production admin CLI in connected Chat. Do not mutate Production while those gates remain open.

## Current implementation: #889 Production migration command safety
- Existing `scripts/appwrite-migrate.mjs` requires `--confirm-project` but (before this task) would select all migrations except 008 when `--only` was absent, even for Production.
- This source-only task will fail closed on unscoped Production migration commands before any HTTP request, using the Git-owned Production project ID; existing non-Production batch semantics and explicitly scoped commands are preserved.
- Scope: migration runner, unit regressions, backend runbook, and this checkpoint. Version impact NONE; no application, Appwrite schema/Function, secrets or provider changes.

## Next action
- Run focused task CI, review scoped diff, then squash into isolated stable Preview for canonical and Vercel delivery; promote to dev only under the protected promotion gate.
- #889 remains blocked before Production writes on positive old-PWA retirement, fresh authenticated R2 health and recovery-key escrow, and checked-out Git-owned exact-target CLI credentials. Then approved 010–015 one at a time, inactive Function READY/activation, real two-account/offline/mobile/privacy acceptance, and separate #909 main release review.
