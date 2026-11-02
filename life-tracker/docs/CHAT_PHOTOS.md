# Chat photo attachments — v0.59.0 integrated Preview candidate (#1460)

**Status:** v0.46.0 chat photos were tested and accepted on Scratch Preview. This v0.46.1 frontend-only iteration adds source-derived photo thumbnails to composer and inline reply quotes, with no additional upload, ACL grant or remote schema. The feature remains guarded by `VITE_CHAT_PHOTOS_ENABLED`, enabled only on the dedicated Scratch Preview branch. No protected dev/main/Production promotion is authorized.

Reply thumbnails use the existing authenticated, account-scoped photo loader. The source message must be available in the current conversation; deleted or unsent source media is not displayed. Incoming recipient row IDs are normalized to the original message identity when creating a new reply so both participants can resolve its photo. Older replies whose source is unavailable retain their text snapshot without inferring new media permissions.

## Contract and boundaries

- Single static photo per 1:1 chat message with optional caption. Client stages compressed WebP bytes in owner-scoped IndexedDB before inserting a pending RxDB message; the photo file ID is deterministic from the message ID. Photo bytes never enter chat message text fields.
- Optional `attachment_type=image`, `attachment_file_id=chat_*` columns in `messages`, versioned RxDB migration, sync mapping, and server-issued sender/recipient rows. Text-only messages remain valid. Still-supported older PWAs see the `[Photo]` textual fallback.
- Existing `task_images` bucket is reused **without public/read(users) media grants**. Private photo starts owner-readable; trusted Function validates friendship, file identity, MIME type, size, bucket read ACL, file owner read/update/delete grants, and authorized recipient before allowing recipient read-only access. The Function requires server-only `buckets.read` scope for bucket metadata, alongside existing `files.read`/`files.write`.
- Delivery ack requires the server pair receipt. Web Locks serialize in-browser upload/unsend attempts. Owner-staged blobs, local image cache and erasure are account-isolated.
- Unsend may conceal the message locally before server confirmation; an error is not proof of server-side deletion. No claim to recall copies saved/downloaded by users.

## Release blockers before enabling

1. **Durable cleanup:** server unsend currently deletes a file before clearing both message rows, with no durable crash-recovery cleanup marker. Partially uploaded photos may also be orphaned by failed deliveries; the existing bounded message-action queue can exhaust. Define and test server-owned reconciliation before enabling.
2. **Historical compatibility:** run `node scripts/check-backend-consumer-compat.mjs --all`, then a genuine old/new installed-PWA rehearsal (#914) including old writer behavior, offline queues, typed photo fields and unsend.
3. **Scratch readiness:** verify exact Scratch project `6a96e82d000d1310b3be`, real bucket ACL, additive migration `017-message-chat-photos`, exact reviewed current shared `message-action` deployment and its active Function ID, registered Preview origin and Diary sync. Use Git-owned migration and Function deploy scripts; never edit Console schema or silently overwrite unrelated shared-Scratch deployments.
4. **Adversarial hosted checks:** three disposable accounts A/B/C. A/B accepted friends, C outsider; deny C and anonymous photo reads; ensure B cannot update/delete A's file; confirm identical sender/recipient metadata and media bytes; ensure unreadable/absent files never count delivered.
5. **Device tests:** installed Android PWA and desktop, offline/restart/slow upload/cancel/account switch, concurrent tabs and devices, reactions/unsend/repair, scroll/layout/pinch-to-zoom and media memory.

## Verification

Complete focused tests, full canonical Quality Gate and production build, real Scratch schema/Function readiness, trusted active deployment, hosted authenticated Preview and actual manual device tests. The feature flag stays disabled and previous Function deployment preserved until compatibility and privacy are proven. Protected dev/main promotion and Production backend/schema changes require separate approval. Refs #745, #914, #936, #937 and #1460.

## One-command Scratch backend activation

Run only from the exact accepted Preview checkout at its reviewed full SHA, with a Scratch-scoped key held in local environment (never paste secrets into chat). After canonical CI succeeds, the guarded command performs pinned historical-client compatibility, migration 017, Function configuration, inactive source deployment, explicit activation and readiness recheck; a readiness failure rolls the deployment back.

```bash
cd life-tracker
export APPWRITE_API_KEY="<your scratch-scoped key>"
npm run appwrite:photo:scratch-ready -- --project 6a96e82d000d1310b3be --endpoint https://fra.cloud.appwrite.io/v1 --confirm-project 6a96e82d000d1310b3be --git-sha "$(git rev-parse HEAD)"
```

Never set the Preview feature flag before the command reports `SCRATCH_PHOTO_BACKEND_READY` and hosted A/B/C authorization checks are complete. The Scratch hourly schedule remains disabled.
