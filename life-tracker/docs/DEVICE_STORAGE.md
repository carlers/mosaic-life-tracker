# Device storage management â€” #1476

The first version of Storage lives under Settings â†’ Data & Sync and loads only on that route.

## Account and data boundaries

- Browser `navigator.storage.estimate()` usage/quota is an approximate **origin-level** report, not available device space or an account allowance. The page separately measures `mosaic_image_cache` downloaded Blob bytes and only the signed-in owner's staged pending-image uploads. The three numbers are independent, not additive.
- Image cache is currently **device-wide**, keyed by file ID and limited to 50 MiB. Its usage and clear action explicitly apply to all accounts on this browser. Do not advertise them as per-account. Image cache content can be refetched only when the authorized remote original remains accessible online.
- Pending `mosaic_pending_images` entries are owner-tagged and must never be deleted by routine cleanup. They contain the only available upload data until sync completes. RxDB, sync metadata, outboxes, PWA assets, local-only data and authenticated cloud files are outside the clear action.
- The browser may deny persistent storage or evict it despite app requests. Unsupported APIs must display **Unavailable**. The page is informational and cannot guarantee persistence.
- Clear cache uses only the separate `clearAllCachedImages` IndexedDB transaction. It is idempotent. Other tabs/image loads may repopulate it after clearing; report the refreshed measured result rather than assuming a permane¶»§q«^