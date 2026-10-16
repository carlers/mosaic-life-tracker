# Session checkpoint

Updated: 2026-10-16 UTC
Current task: #889 integrated Production-target acceptance before v0.29.1 pre-1.0 release.

## Current verified state
- Protected `dev@c733bfa73f4ca742f6333ee75e11c642f83daf53` = v0.29.1, full Quality Gate #38891390926 SUCCESS and exact dev Vercel READY. Protected `main@1f146ba7e935a1f2595c176ca21f41413698d2c0` = v0.17.4, Vercel Production READY; #909 OPEN, unmerged, 1.0.0 not approved.
- Owner confirmed every known old v0.17.4 PWA synced/retired plus independent R2/encryption key escrow; authenticated `npm run dr:check` PASS for snapshot `20261016T110126909Z`, completed 2026-10-16 11:02:17 UTC. This is owner attestation, not independently observed per device.
- Approved Production schema 010–015 actually applied and individually verified via authenticated connected Appwrite API from exact Git manifest (preferred CLI blocked by credential-transfer checks): 17 tables, Diary 9 AVAILABLE columns, Messages 25 AVAILABLE columns; no 008/unscoped migration. New `message-action@6ad20d5de9380307809d` active READY from exact dev source; prior `6acb8162dc02a1deaa23` retained READY, cron/scopes/variables same. `dr_backup` unchanged. Details: issue #889 comment 6214794662.
- Read-only `get_notifications` smoke on active Production Function returned HTTP 200. An independently rebuilt local Production-target v0.29.1 bundle passed build/PWA/size checks, HTTPS root and deep-link HTTP 200, and embeds approved Production Appwrite ID. This does NOT prove actual two-account/offline/mobile privacy acceptance.
- The existing Production Appwrite Web platform registers a private laptop address, enabling a **local** v0.29.1 Production-target acceptance build without redirecting official Vercel Previews away from Scratch or merging main.

## Current source-only task
- Document the repeatable exact-SHA local Production-target acceptance protocol in `docs/PRODUCTION_ACCEPTANCE.md`, link it from `docs/README.md` and `docs/PRODUCTION_RELEASE_READINESS.md`, and replace this stale checkpoint with factual milestones.
- Version impact NONE. No app behavior, Vercel/provider configuration, Appwrite schema/Function or protected branch promotion in this documentation task.

## Remaining release gates
- Owner real signed-in two-account Diary/chat/reactions/notifications/private-record/offline/mobile/PWA acceptance on Production-target v0.29.1. Certificate-related PWA limitations remain BLOCKED until genuinely verified.
- Current health/restore evidence, exact dev CI, and source pin rechecked before *separately approved* #909 dev→main merge; main full CI, matching Production Vercel deployment and release publisher then verified. No v1.0.0 tag.
