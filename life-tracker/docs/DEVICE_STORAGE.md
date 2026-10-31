# Device storage management — #1476

The first version of Storage lives under Settings → Data & Sync and loads only on that route.

## Account and data boundaries

- Browser `navigator.storage.estimate()` usage/quota is an approximate **origin-level** report, not available device space or an account allowance. The page separately measures `mosaic_image_cache` downloaded Blob bytes and only the signed-in owner's staged pending-image uploads. The three numbers are independent, not additive.
- Image cache is currently **device-wide**, keyed by file ID and limited to 50 MiB. Its usage and clear action explicitly apply to all accounts on this browser. Do not advertise them as per-account. Image cache content can be refetched only when the authorized remote original remains accessible online.
- Pending `mosaic_pending_images` entries are owner-tagged and must never be deleted by routine cleanup. They contain the only available upload data until sync completes. RxDB, sync metadata, outboxes, PWA assets, local-only data and authenticated cloud files are outside the clear action.
- The browser may deny persistent storage or evict it despite app requests. Unsupported APIs must display **Unavailable**. The page is informational and cannot guarantee persistence.
- Clear cache uses only the separate `clearAllCachedImages` IndexedDB transaction. It is idempotent. Other tabs/image loads may repopulate it after clearing; report the refreshed measured result rather than assuming a permanent zero.
- `Clear Local Data` is a distinct destructive Settings action and remains unchanged in Phase 1. See #1477 and #1478 for separately gated cloud inventory/deletion.

## Acceptance boundaries

Unit test browser-estimate fallbacks and owner-scoped pending data; DOM test confirmation/no unrelated store changes. Validate cache clearing, offline PWA opening, cached-photo loss/re-download, account switch, concurrent tabs and pending uploads on a physical device. CI/Preview evidence must be recorded before marking accepted. A clean browser estimate never substitutes for queued-sync health.
