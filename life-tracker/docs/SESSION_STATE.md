# Session checkpoint

Updated: 2026-10-10
Current task: Issue #489 — rights-cleared sticker libraries MVP, no private sticker imports.
Baseline: `dev` `60fe24b7852d420ee9c0915ed597ee61bc71801b` (v0.12.1); `main` remains untouched.
Task branch: `chatgpt/sticker-libraries-489`; stable Preview: `feature/sticker-libraries` from the same dev baseline.
Version: v0.16.0 candidate (v0.14.0 and v0.15.0 reserved by other active Preview features).

## Objective / changes

- Replace canceled #413 personal uploads and Android IME ingestion with licensed, server-storage-free curated sticker packs. #413 is closed not planned; do not merge its old feature branch.
- Add immutable versioned pack registry and compact allowlisted message references; only pinned transparent Twemoji SVGs (CC BY 4.0, credited) are fetched directly on demand from jsDelivr. GIPHY is not active without approved key; Pusheen, Sanrio and Adventure Time remain rights-blocked.
- Chat sticker button opens lazy-loaded shared BottomSheet with My Packs, Discover, filter and one-tap message sends, without touching draft text. Per-owner device-local bookmarks, no duplicate Appwrite file, no schema, Function or bucket change.
- Preserve offline outgoing queue, unsend, replies, message search, reaction, status, quote and old-client readable fallback. No outside URLs from message content.

## Verification

Pending focused task CI, stable Preview full canonical CI and same-SHA READY Vercel. Unit/DOM coverage added for allowlist, typed wire, bookmarks, picker, rendering and fallback. These tests are not real phone, licensing for branded packs or two-user Scratch auth verification.

## Next action

Publish coherent task commit with `[verify:focused]`. Fix focused failures, squash task PR to stable Preview, verify exact-SHA canonical acceptance and Vercel READY. Collect manual/Scratch acceptance separately. Do not promote to dev or main without explicit permission.
