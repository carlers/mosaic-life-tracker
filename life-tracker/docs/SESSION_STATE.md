# Session checkpoint

Updated: 2026-10-10
Current task: Issue #413 custom static stickers, explicitly approved implementation from live `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3`.
Task branch: `chatgpt/custom-stickers`. Planned stable Preview: `feature/custom-stickers`. Candidate version: **0.13.0** (MINOR from dev v0.12.1; check branch/version conflicts before publishing).
User priorities: low Appwrite Free-tier storage/bandwidth; upload personal stickers from phone; actual alpha transparency/no white or black bounding rectangles; separately explore licensed libraries (Pusheen, Sanrio, Adventure Time) after personal sticker flow.
Scope: UI, typed text envelope, existing Settings replication row and existing file-secure `task_images` bucket; **no schema/Function migration**. Preserve existing text/task messaging, pre-existing account/queue protections and Home startup. No production changes or copyrighted bundled art authorized.

## Candidate design
- Personal library: up to 32 uploaded stickers, owner-scoped `chat_stickers_v1` setting, account-salted final WebP digest for dedup, 128 KiB/384px cap. WebP canvas conversion strips original metadata and preserves alpha. For opaque inputs remove connected near-white/black edges only; reject complex backgrounds with cutout guidance rather than claim ML segmentation.
- Sticker files start owner-only; on delivery (including offline retry) widen the *file-level* read ACL only to the named recipient, verifying owner permissions first. Reuse **one file per sticker** across chats; do not grant public/bucket-wide read or copy bytes per message. Existing server `deliver` still checks friendship. Embedded v1 marker in regular message content avoids backend schema changes and remains human-readable to older clients.
- Account-scoped cached images, lazy picker/rendered images, bounded memory; no startup preloads. Deleting an unsent/unshared library item can reclaim the file; sent images survive collection removal to preserve chat history. Recipients may retain already shared/downloaded media after an unsend/block.
- Existing settings LWW contention, multi-device simultaneous file permission updates, physical-phone background removal/keyboard interoperability and real scratch Storage ACLs need integration verification.
- Do not bundle Pusheen/Sanrio/Adventure Time imagery without rights. Later packs require separate licensing/original-art review.

## Work and verification status
- GitHub task branch created from exact dev SHA.
- Source changes staged as Git blobs, pending task commit and CI: `stickerProtocol`, `stickerStorage`, `useStickers`, picker/image components, ChatPage/MessageComposer/MessageBubble/ConversationRow/ReplyPreview/MessageActionSheet/search, delivery guard, version/docs and regression tests.
- Initial exact-SHA full CI diagnostic (Actions 38015582873): TypeScript/Vite/PWA compiled, browser contracts and both DOM shards passed, dependency audit passed. Lint failed on an unnecessary regex escape and missing caught-error cause; build-size aggregate exceeded prior limits by raw 11,165 B, gzip 3,572 B, precache 11,408 B. Repairs: eliminate both lint errors; dynamically import sticker storage only on sticker delivery to spare Home/startup closure; adjust **aggregate only** limits to measured feature growth with ~2-3 KiB headroom. Entry/startup/Home ceilings unchanged. No local npm/device check in the GitHub-only connector environment.
- Required next: create coherent commit (size headroom on dev is ~2 KiB aggregate); one measured full CI diagnostic for TypeScript/build-size, fix failures, request focused task SHA, squash to stable Preview and await canonical CI/Vercel READY. Verify Scratch file permissions and two disposable accounts before claiming delivery. `dev` and `main` promotions require separate explicit authorization.

## Blockers/limitations
- Scratch registered Preview origin capacity is constrained on Appwrite Free; only use a registered stable Vercel alias.
- Background removal for detailed real-world photos cannot be guaranteed by threshold cutout; the picker explicitly instructs the user to produce a transparent cutout first.
- OS-native sticker keyboards may not hand proprietary sticker data to PWAs; Photos/Files exports are supported instead.
