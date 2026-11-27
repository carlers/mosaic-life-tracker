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

## November 27, 2026 — source-only pagination and account-scope hardening

The Preview-only broker returns `pagination.scanned`, counting **raw upstream
rows consumed**, while `results` contains only sanitized movie/episode rows.
The browser advances its bounded offset by `scanned` rather than counting
filtered records. A page with no visible entries can still offer the next
page; an upstream empty page that advertises more records fails closed. This
prevents repeated requests and missing results when unsupported media types
are removed. No original private notes, provider URLs, token, or other
unsupported payload fields are returned.

The lazy Day View media activity is also keyed by both the active Mosaic
account ID and selected day so an account switch unmounts outstanding
owner-scoped requests and cannot reuse the previous owner's displayed media.
The server's independent JWT/owner/project check remains authoritative.

These changes are synthetic-source behavior only, not proof of a live Floppy
API response, Appwrite Preview Function deployment, an authenticated user
session, or private tailnet reachability. Keep the pilot disabled until
those checks pass; no Production or shared backend changes.

## Pinned upstream source contract proof (synthetic, no owner data)

Reviewed exact upstream Floppy commit
[`11901654d30fd1f7881f1a45c5d97aa09a9cd88e`](https://github.com/dannyvfilms/Floppy/tree/11901654d30fd1f7881f1a45c5d97aa09a9cd88e).
The [API HistoryView source](https://github.com/dannyvfilms/Floppy/blob/11901654d30fd1f7881f1a45c5d97aa09a9cd88e/src/api/fork_views_tracking.py)
accepts `types`, a day range, `flat=1`, `limit` and `offset`;
flat mode pages the nested cache-derived entry rows, not date groups.
The [record builders](https://github.com/dannyvfilms/Floppy/blob/11901654d30fd1f7881f1a45c5d97aa09a9cd88e/src/app/history_entry_builders.py)
produce a `movie_tracker` row with tracker `instance_id`, title, `played_at_local`
and `item`; episodes have an episode `instance_id`, `episode_code`
and `show.title`.
The [history cache](https://github.com/dannyvfilms/Floppy/blob/11901654d30fd1f7881f1a45c5d97aa09a9cd88e/src/app/history_cache.py)
overrides each movie tracker's `play_count` with a per-item aggregate.
Therefore a single movie tracker may represent multiple historical watches;
the current Day View MUST NOT manufacture dates or separate entries for
those watches. For actual rewatch dates, verify the separate per-media play
endpoint on the pinned running service before adding any expansion.

The unit-test fixture models these verified upstream fields with invented
media IDs, titles and timestamps. It is **not** a live Floppy HTTP fixture
and cannot prove actual configured permissions, response pagination, tailnet
HTTPS, user credentials or Appwrite Function delivery.

## Source-only per-play rewatch expansion groundwork

At pinned upstream Floppy commit `11901654d30fd1f7881f1a45c5d97aa09a9cd88e`,
[`api.views.MediaConsumptionHistoryView`](https://github.com/dannyvfilms/Floppy/blob/11901654d30fd1f7881f1a45c5d97aa09a9cd88e/src/api/views.py)
exposes a *different* endpoint, `GET /api/v1/media/movie/{source}/{media_id}/history/`,
that returns per-media tracked consumption entries. Once MoviePlay records
exist, it returns those play rows; otherwise it falls back to the single movie
tracker. [`HistorySerializer`](https://github.com/dannyvfilms/Floppy/blob/11901654d30fd1f7881f1a45c5d97aa09a9cd88e/src/api/serializers.py)
provides `consumption_id`, `end_date`, `score` and private fields such as
`notes`, which Mosaic must not surface. The upstream scope registry maps
both read-only history endpoints to `watchlist:read`.

`src/lib/floppyMoviePlays.ts` now parses bounded synthetic MoviePlay
pages into just stable play IDs and UTC instants. It **never** assigns a
Floppy-local calendar day from a UTC timestamp, returns notes, or automatically
fetches from the network. Rewatch expansion and fetching remain disabled:
validate the actual service version, owner timezone, credential scope and
per-play pagination before wiring a trusted broker to Day View. This is
isolated, source-only future capability, not a confirmed live per-play result.

## 2026-11-27 — private origin and canonical pagination hardening

The Oracle root cohost manifest uses **Tailscale Serve HTTPS on port 8443**,
not the default 443. The first broker draft accidentally allowed only HTTPS
443 and thus would reject the intended host. The read-only Appwrite Preview
broker now **only** accepts exact `https://<machine>.<tailnet>.ts.net:8443`
origins without credentials, path, query, fragment, or an alternate port.
The provider bearer token is never sent to generic public HTTPS or an IP
literal. The authenticated `status` reply now checks token length consistently
with `history`; pagination rejects a page whose rows overrun the upstream
advertised total. Synthetic negative tests cover those constraints.

This is a static allowlist, not a live proof of Tailnet name resolution,
certificate trust or the Function container's ability to reach the local
Tailscale Serve endpoint. Keep the pilot disabled pending that proof.
