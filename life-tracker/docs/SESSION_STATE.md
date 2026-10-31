# Current task: #1460 chat photo reply thumbnails — v0.46.1 Preview
Updated: 2026-11-01 Asia/Manila

- User accepted v0.46.0 Scratch photo Preview and requested image thumbnails in reply quotes. Source of truth: `feature/1460-chat-photos-privacy-v0460-20261101` at `19c4a716df424b016f87452b19778fb9051bb2b8`. Scratch schema and `message-action` Function activated, canonical CI passed, Production/dev/main unchanged.
- Frontend-only v0.46.1 task: show compressed existing photo in composer and inline quoted replies, resolve original IDs from local conversation across sender/recipient copies, never render deleted/unsent photo thumbnails, lazy-load thumbnail storage code and revoke URL on cleanup.
- No new media upload, Appwrite migration, Function replacement or backend write. Preserve original photo compression WebP (1024px max dimension, target 0.15 MB, max 262144 bytes) and owner-based ACL. Source absent/offline with no cached image -> textual/unavailable fallback.
- Deliver isolated source commit, focused tests, canonical CI and exact-SHA READY Scratch Preview. Outstanding: manual browser/device photo-reply test, original cross-device ACL acceptance. Do not promote to dev/main/Production without explicit approval.
- Issue: https://github.com/carlers/mosaic-life-tracker/issues/1460

---
