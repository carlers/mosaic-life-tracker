# Floppy movie and TV provider contract — issue #2402

This is **source work only**, not a live Mosaic integration. It intentionally
does not expose credentials in the client, create Appwrite user records,
turn movies into tasks, or enable the feature in Home.

## Upstream verified surface

Floppy `GET /api/v1/history/?flat=1&start_date=YYYY-MM-DD&end_date=YYYY-MM-DD&types=movie,episode`
accepts `watchlist:read` app tokens, with `limit` up to 200 and `offset`.
The flat endpoint returns per-*history card* rows; **Floppy's movie card is a
tracker-level item with `play_count`**, so this response does **not** provide
the original date of every rewatch. Per-media `/api/v1/media/movie/{source}/{id}/history/`
can return individual `MoviePlay` rows. We must prove pagination, identity,
date semantics and cost of rewatch expansion against the pinned running
release **before showing per-rewatch events in Mosaic**.

`src/lib/floppyHistory.ts` holds a deliberately strict parser and bounded
date query helper for a trusted connector. The browser must never call Floppy
directly with a provider token. Do not surface this work as completed until
the Oracle install, credential vault, authenticated broker, data classification
and feature Preview are verified.

## Readiness gates

- Independently authorize and install a narrowly allowlisted Oracle media
  operator; verify memory/disk headroom and no impact to Appwrite.
- Pin a tested upstream Floppy image, route private HTTPS, close signups,
  back up and restore synthetic data. Never use shared demo credentials.
- Pin API response fixtures from actual `/history` and per-movie-history.
- Implement per-account credential grant/rotation/revocation in a trusted
  server gateway, with an explicit #1662 E2EE compatibility decision.
- Load the integration UI only after enabling the verified backend; no
  startup dependency on Floppy. Test offline, date changes, deletes and
  multi-account isolation.
- Complete focused + canonical CI and exact-SHA official Mosaic Preview
  before asking the owner to accept it. All promotions separately approved.
