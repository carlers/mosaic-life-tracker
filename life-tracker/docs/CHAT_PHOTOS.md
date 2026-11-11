# Chat photo attachments — rollout and acceptance (#1460)

**Dated rollout evidence (verified against Git on 2026-11-11):** [PR #1576](https://github.com/carlers/mosaic-life-tracker/pull/1576) merged v0.63.0 chat-photo source into `dev` on 2026-11-01. A **2026-11-10** Vercel environment readback reported `VITE_CHAT_PHOTOS_ENABLED=true` on the `dev` Preview branch and historical feature Previews, with no Production-target entry. That readback is historical configuration evidence, **not** proof of the currently deployed bundle, active Function or Production state. The 2026-11-10 dev snapshot (`1f5ec7ae`) reported v0.93.1; the independently checked 2026-11-11 `dev@bf50d203` package and `appVersion.ts` report v0.97.3. Recheck live Git, Vercel and backend readiness before rollout decisions. Issue #1460 remains open for hosted three-account privacy checks and physical-device acceptance. The documented Preview/Dev backend target is Oracle Scratch `6ae94a2100014d01f5ed`, not legacy Cloud Scratch `6a96e82d000d1310b3be`; the guarded `appwrite-chat-photo-scratch-ready.mjs` source restricts operations to the reviewed Scratch project and migration 017. This document does not establish present backend readiness.

Reply thumbnails use the existing authenticated, account-scoped photo loader. The source message must be available in the current conversation; deleted or unsent source media is not displayed. Incoming recipient row IDs are normalized to the original message identity when creating a new reply so both participants can resolve its photo. Older replies whose source is unavailable retain their text snapshot without inferring new media permissions.

## Contract and boundaries

- Single static photo per 1:1 chat message with optional caption. Client stages compressed WebP bytes in owner-scoped IndexedDB before inserting a pending RxDB message; the photo file ID is deterministic from the message ID. Photo bytes never enter chat message text fields.
- Optional `attachment_type=image`, `attachment_file_id=chat_*` columns in `messages`, versioned RxDB migration, sync mapping, and server-issued sender/recipient rows. Text-only messages remain valid. Still-supported older PWAs see the `[Photo]` textual fallback.
- Existing `task_images` bucket is reused **without public/read(users) media grants**. Private photo starts owner-readable; trusted Function validates friendship, file identity, MIME type, size, bucket read ACL, file owner read/update/delete grants, and authorized recipient before allowing recipient read-only access. The Function requires server-only `buckets.read` scope for bucket metadata, alongside existing `files.read`/`files.write`.
- Delivery ack requires the server pair receipt. Web Locks serialize in-browser upload/unsend attempts. Owner-staged blobs, local image cache and erasure are account-isolated.
- Unsend may conceal the message locally before server confirmation; an error is not proof of server-side deletion. No claim to recall copies saved/downloaded by users.

## Gates before wider rollout

1. **Durable cleanup:** server unsend currently deletes a file before clearing both message rows, with no durable crash-recovery cleanup marker. Partially uploaded photos may also be orphaned by failed deliveries; the existing bounded message-action queue can exhaust. A [2026-11-11 test-only race probe](https://github.com/carlers/mosaic-life-tracker/issues/1460#issuecomment-6793304219) additionally reproduced deletion of a listed owner-private orphan candidate after the file acquired recipient-read permission, because final deletion rechecks sender delete ownership but not the now-shared ACL. This is synthetic source/test-double evidence, **not** verified live data loss. Investigate and address this race, partial message-pair states and server-owned reconciliation before any wider rollout; do not treat this documentation note as runtime remediation.
2. **Historical compatibility:** run `node scripts/check-backend-consumer-compat.mjs --all`, then a genuine old/new installed-PWA rehearsal (#914) including old writer behavior, offline queues, typed photo fields and unsend.
3. **Current Oracle Scratch readiness:** verify project `6ae94a2100014d01f5ed` at `https://129-221-244-67.sslip.io/v1`, real bucket ACL, additive migration `017-message-chat-photos`, exact reviewed shared `message-action` deployment and active Function ID, registered Preview origin and Diary sync. The legacy Cloud Scratch `6a96e82d000d1310b3be` is used by the separate MCP sidecar and is not the current PWA target. Use Git-owned migration and Function deploy scripts; never edit Console schema or silently overwrite shared deployments.
4. **Adversarial hosted checks:** three disposable accounts A/B/C. A/B accepted friends, C outsider; deny C and anonymous photo reads; ensure B cannot update/delete A's file; confirm identical sender/recipient metadata and media bytes; ensure unreadable/absent files never count delivered.
5. **Device tests:** installed Android PWA and desktop, offline/restart/slow upload/cancel/account switch, concurrent tabs and devices, reactions/unsend/repair, scroll/layout/pinch-to-zoom and media memory.

## Verification

Complete focused tests, full canonical Quality Gate and production build, current Oracle Scratch schema/Function readiness, trusted active deployment, hosted authenticated Preview and actual manual device tests. Keep the feature flag branch-scoped to the already accepted dev Preview only; do not enable it on other branches or Production until compatibility and privacy are proven. Preserve the previous Function deployment for rollback. Main/Production promotion and backend/schema changes require separate approval. Refs #745, #914, #936, #937 and #1460.

## One-command Scratch backend activation

Run only from the exact accepted Preview checkout at its reviewed full SHA, with a Scratch-scoped key held in local environment (never paste secrets into chat). After canonical CI succeeds, the guarded command performs pinned historical-client compatibility, migration 017, Function configuration, inactive source deployment, explicit activation and readiness recheck; a readiness failure rolls the deployment back.

```bash
cd life-tracker
export APPWRITE_API_KEY="<your scratch-scoped key>"
npm run appwrite:photo:scratch-ready -- --project 6ae94a2100014d01f5ed --endpoint https://129-221-244-67.sslip.io/v1 --confirm-project 6ae94a2100014d01f5ed --git-sha "$(git rev-parse HEAD)"
```

Do not widen the branch-scoped Preview feature flag or enable Production. The current Oracle Scratch schema/Function must be re-read before running the guarded command; historical Cloud Scratch READY evidence does not transfer across projects. The Scratch hourly schedule remains disabled.
