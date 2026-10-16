# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #592 PR preflight CI-race hardening, while #889 Production release remains gated.

## Current verified state
- Protected `dev@cfb877f88345c761a02cef40baed71cb74376f2c` = v0.29.1. #924 ancestry reconciliation has merged; postmerge Quality Gate #38878427030 SUCCESS (promotion reuse), exact dev Vercel `dpl_6DjV2a3EmEfyRxiURX5Mf9S5q5gz` READY.
- Protected `main@1f146ba7e935a1f2595c176ca21f41413698d2c0` = v0.17.4. #909 pre-1.0 PR open, not released; main Production Vercel `dpl_3fS5n8JbG2QaVH9GgNistHpqT7EV` READY.
- Production Appwrite project `6a9703c50016b37110ff` remains 14 tables, Diary 7 columns, Messages 21, old `message-action@6acb8162dc02a1deaa23` hourly, `dr_backup@6ac25457acb18594b6c2` daily. #914 Phase A on dev; legacy v0.17.4 client cannot read new optional fields.
- Owner approved exact Production migrations 010–015 and message-action upgrade, but **never confirmed** all old PWA/tab/account offline queues synced and installations retired. Authenticated *current* R2 `COMPLETED`/manifest/escrow check remains outstanding, as does a target-pinned Git CLI environment. No Production backend writes until these proofs; no main or v1.0.0 approval inferred.

## Current implementation: #592 exact-SHA PR preflight race
- The #909 PR preflight failed prematurely twice after dev promotions (#38856664192, #38878432680 attempt 1), then passed after exact dev canonical settled. The tracked defect is cross-event timing, not a failed source test.
- This task changes only `scripts/lib/promotion-pr-evidence.mjs`, `scripts/check-promotion-pr.mjs`, `tests/unit/promotionPrEvidence.test.ts` and `docs/DELIVERY.md`, plus this checkpoint. No application/UI/backend/version behavior changes.
- Preflight retries boundedly *only* when exact-SHA canonical missing/pending is the sole failure; checks live PR/ref on every attempt; stops on terminal failure, drift, timeout. Regression coverage protects newest-run semantics, queued/missing→success, mismatches and deadline.

## Next action
- Run focused branch check, squash accepted task into an isolated `fix/*` stable Preview, obtain canonical + Preview READY, then promote only through reviewed protected PR and exact source checks. #889 Production rollout still requires owner-device retirement and authenticated escrowed R2 health with repo-owned CLI; never use direct cloud mutations as a substitute.
