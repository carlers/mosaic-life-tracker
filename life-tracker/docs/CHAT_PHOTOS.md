# Chat photo attachments — v0.46.0 isolated candidate (#1460)

**Status: NOT ENABLED / NOT ACCEPTED.** Source work is on `chatgpt/1460-chat-photo-foundation-v0450-20261031`, not protected `dev` or `main`. `VITE_CHAT_PHOTOS_ENABLED` defaults to `false` and MUST remain false until Scratch tests pass. No Production rollout is authorized by #1460.

## Contract and boundaries

- Single static photo per 1:1 chat message with optional caption. Client stages compressed WebP bytes in owner-scoped IndexedDB before inserting a pending RxDB message; the photo file ID is deterministic from the message ID. Photo bytes never enter chat message text fields.
- Optional `attachment_type=image`, `attachment_file_id=chat_*` columns in `messages`, versioned RxDB migration, sync mapping, and server-issued sender/recipient rows. Text-only messages remain valid. Still-supported older PWAs see the `[Photo]` textual fallback.
- Existing `task_images` bucket is reused **without public/read(users) media grants**. Private photo starts owner-readable; trusted Function validates friendship, file identity, MIME type, size, bucket read ACL, file owner read/update/delete grants, and authorized recipient before allowing recipient read-only access. The Function requires server-only `buckets.read` scope for bucket metadata, alongside existing `files.read`/`files.write`.
- Delivery ack requires the server pair receipt. Web Locks serialize in-browser upload/unsend attempts. Owner-staged blobs, local image cache and erasure are account-isolated.
- Unsend may conceal the message locally before server confirmation; an error is not proof of server-side deletion. No claim to recall copies saved/downloaded by users.

## Release blockers before enabling

1. **Durable cleanup:** server unsend currently deletes a file before clearing both message rows, with no durable crash-recovery cleanup marker. Partially uploaded photos may also be orphaned by failed deliveries; the existing bounded message-action queue can exhaust. Define and test server-owned reconciliation before enabling.
2. **Historical compatibility:** run `node scripts/check-backend-consumer-compat.mjs --all`, then a genuine old/new installed-PWA rehearsal (#914) including old writer behavior, offline queues, typed photo fields and unsend.
3. **Scratch readiness:** verify exact Scratch project `6a96e82d000d1310b3be`, real bucket ACL, additive migration `016-message-chat-photos`, exact reviewed current shared `message-action` deployment and its active Function ID, registered Preview origin and Diary sync. Use Git-owned migration and Function deploy scripts; never edit Console schema or silently overwrite unrelated shared-Scratch deployments.
4. **Adversarial hosted checks:** three disposable accounts A/B/C. A/B accepted friends, C outsider; deny C and anonymous photo reads; ensure B cannot update/delete A's file; confirm identical sender/recipient metadata and media bytes; ensure unreadable/absent files never count delivered.
5. **Device tests:** installed Android PWA and desktop, offline/restart/slow upload/cancel/account switch, concurrent tabs and devices, reactions/unsend/repair, scroll/layout/pinch-to-zoom and media memory.

## Verification

Complete focused tests, full canonical Quality Gate and production build, real Scratch schema/Function readiness, trusted active deployment, hosted authenticated Preview and actual manual device tests. The feature flag stays disabled and previous Function deployment preserved until compatibility and privacy are proven. Protected dev/main promotion and Production backend/schema changes require separate approval. Refs #745, #914, #936, #937 and #1460.
