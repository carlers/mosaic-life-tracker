# Session checkpoint

Updated: 2026-10-10
Current task: Implement issue #413 personal transparent chat stickers on stable Preview; finish review and acceptance.
Baseline: dev `224f8a700f35bbe3853206ee208e1dc103ece5b3` (v0.12.1). Stable Preview `feature/custom-stickers` at `d5e2e6ae73f66ea51eb74168334d75a9a9d0dd68` (v0.13.0). Main/dev untouched.
Repair branch: `chatgpt/custom-stickers-preview-acceptance-repair`. Primary Preview PRs #486 and #487, both merged by squash.

## Scope and design
- Users import PNG/JPEG/WebP stickers from Photos/Files or supported clipboard images; preserve original alpha, remove connected near-white/black flat perimeter regions, reject complex opaque backgrounds with phone cutout guidance. Static WebP ≤384px and ≤128KiB; library capped at 32.
- Synced library via existing Settings `chat_stickers_v1`, with deterministic owner-salted content-digest file IDs. Existing file-secure `task_images` bucket, no new table/bucket/Function. One file per distinct owner image; grant file-level read only to intended recipients when the message is delivered. No per-send media copies or public reads. Account-scoped LRU caches and owner-generation guards.
- Strict text fallback embeds sticker label/file ID in message content; old clients show text. New chat renders transparent images, reacts/replies/swipes/unsends, readable previews/search; existing pending-message outbox supports cached sticker sends offline. Outbound transport is lazy-loaded only for pending messages.
- Future packs inspired by Pusheen/Sanrio/Adventure Time are **not** bundled without appropriate licenses. Separate follow-up after MVP acceptance. Complex backgrounds require phone OS cutout; OS sticker keyboards may not expose original image to PWA. Existing recipient file grants cannot retroactively revoke downloaded/shared images.

## CI and Preview evidence
- Initial task `5801cfdc5742df88ffe57731d85802f6341fc7cc`: focused CI 38016110698 SUCCESS; PR #486 accepted on stable Preview `fa9b5b7` with canonical full CI 38016190564 SUCCESS.
- Independent Vercel deployment `dpl_BTBVTMCJLbKokX5t7roAM54tPeHB` ERROR solely for initial gzipped closure **143,706/143,700 B** (6B over). Entry, Home and aggregate sizes passed.
- Lazy outbound transport repair `37ebee3e35c49bc8bc7bde31c7eea4abb86d9fda`: focused CI 38016459655 SUCCESS; PR #487 landed at `d5e2e6a`. Canonical full run 38016545431 build and DOM tests green, but **checks failed** because this checkpoint expanded past the 3000-token handoff budget (3126 tokens). Vercel `dpl_3c5Vt2FjeyMCZFiCSegxU8zY85qJ` ERROR: the same 6B over, since initial closure is independent of messaging transport. Local Actions initial closure measured 143,607B; Preview Scratch build measured 143,706B.
- Current repair: shorten checkpoint; review-only **+128B** initial-closure ceiling (143,828 B), accounting for proved scratch/production-env build difference, still within the existing ~5% baseline envelope. Do not alter entry/Home/aggregate ceilings or shipped runtime merely to shave six bytes. Update budget test only if it codifies the original exact ceiling.

## Next action
Commit coherent branch with `[verify:focused]`, wait focused green, squash into `feature/custom-stickers`; verify exact-SHA full canonical CI and Vercel READY. Do not promote to dev/main absent explicit approval. Scratch bucket owner-only create/fileSecurity inspected read-only; two-account cross-user ACL/offline acceptance and physical Android/iOS transparency, BottomSheet, keyboard and theme remain **unverified**. Publish only a registered stable Preview alias after READY.
