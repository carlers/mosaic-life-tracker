# Session checkpoint

Updated: 2026-10-10
Current task: Independent double-check and focused repair of approved issue #413 custom stickers.
Source: `feature/custom-stickers` SHA `91725dbf5a246f6307f92a1dcf7fffc4beca97ec` v0.13.0, full canonical CI 38016785395 SUCCESS and exact Vercel READY. `dev` still `224f8a700f35bbe3853206ee208e1dc103ece5b3` v0.12.1; no promotion.
Task branch: `chatgpt/custom-stickers-double-check` based on that stable feature SHA. Planned user-testable repaired Preview: **v0.13.1** per PATCH policy. Stable target stays `feature/custom-stickers`.

## Verified bugs and repairs in task
- Sticker images were fetched immediately for *every* message on chat mount and duplicate simultaneous messages downloaded the *same* file repeatedly, wasting Appwrite Free-tier bandwidth. `StickerImage` now loads only near viewport using IntersectionObserver with no-IO fallback; `stickerStorage` coalesces per-owner/generation/file inflight loads into one fetch.
- A placeholder remained after connectivity returned; visible not-yet-loaded images now retry once on a real offline/checking → online status transition rather than repeatedly retrying on every health update.
- Inflight image fetch could finish after account switch. Loader checks account generation before display/caching; an unusable IndexedDB cache does not prevent online rendering. Storage 401 is handled through guarded auth instead of being silently treated as not found.
- Updated regression coverage targets concurrent reuse, account-switch race, cache failure, lazy viewport loading, offline recovery.
- Candidate app version changed from 0.13.0 to 0.13.1. Backend manifest, bucket, Function and media format unchanged.

## Risks and acceptance
- **Open critical race:** updating Appwrite Storage file-level recipient ACL is a last-writer-wins read-modify-write. Two devices sharing one owner sticker with different recipients can erase one another's read grants. There is no atomic compare-and-set in this existing client API; do NOT claim recipient isolation/cross-device sending accepted until proven on Scratch or a backend-authorized serialization design has been implemented.
- Browser OS sticker keyboard/PWA input availability and transparent cutout of arbitrary photos remain explicitly limited; phone Photos/Files and clipboard image is the supported path. Existing alpha is preserved; near-solid white/black background removal is heuristic and can damage artwork; complex photos require OS cutout. Real mobile acceptance remains unverified.
- Scratch Appwrite bucket `task_images` inspected read-only, fileSecurity true, bucket create-only permissions, usage 0 B. The actual stable Vercel alias `mosaic-life-tracker-git-feature-8511b9-carls-projects-72516fde.vercel.app` is NOT exactly registered in Scratch Web platform list; wildcard `*.vercel.app` exists but repo policy explicitly requires exact alias for authenticated handoff. Do not treat this as authenticated browser acceptance.
- Character libraries remain issue #489, license-dependent. No copyrighted packs bundled.
- Required next: request task focused CI, diagnose/repair, squash through PR onto stable Preview, verify exact SHA full CI and Vercel READY. Two-user Scratch file ACL/remaining device tests still outstanding. Production and dev untouched. Do not merge/promote without explicit instruction.
