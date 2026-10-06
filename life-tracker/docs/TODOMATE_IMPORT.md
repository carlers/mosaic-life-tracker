# TodoMate import

This document is the authoritative contract for the one-way TodoMate → Mosaic personal-data
migration. It is separate from Mosaic user backups and administrator disaster recovery.

## Purpose

TodoMate's first-party export may not be available to every account. Mosaic can instead read
the signed-in user's own TodoMate web data through TodoMate's Firebase backend and convert it
into Mosaic's existing Merge-restore path.

The importer is a migration tool, not a sync integration:

- TodoMate is read-only.
- Nothing is written back to TodoMate.
- There is no ongoing TodoMate connection after the transfer.
- Re-running the importer is supported and must remain idempotent.

## Credential and network boundary

The browser first attempts to retrieve TodoMate's public Firebase web configuration from
`https://www.todomate.net/__/firebase/init.json`. TodoMate does not guarantee that this
endpoint permits cross-origin browser reads, so Mosaic also carries a pinned fallback copy
of TodoMate's public Firebase web API key/project ID. The fallback contains no user secret
and is used only when runtime discovery is blocked or unavailable.

The user enters their TodoMate email/password in the local Mosaic UI. Mosaic sends those
credentials directly from the browser to Google's Firebase Identity Toolkit login endpoint.
The password is held only in component memory and is cleared immediately after the preview
attempt completes. Mosaic does not persist the password, refresh token, or Firebase ID token.

Authenticated reads then go directly to the TodoMate Firebase project through the Firestore
REST API. Mosaic must never route TodoMate credentials, Firebase tokens, or personal TodoMate
records through an unrelated migration proxy or Mosaic's Appwrite backend.

Do not log:

- TodoMate passwords
- Firebase ID/refresh tokens
- Authorization headers
- raw TodoMate response bodies
- imported task/diary content

The Firebase web API key is public client configuration, not a user secret. Mosaic prefers
runtime discovery and may pin the same public web configuration as a compatibility fallback
when TodoMate's init endpoint is CORS-blocked.

## Read scope

After authentication, Mosaic requests only records owned by the connected TodoMate account:

- `Goal` where `userID == <TodoMate UID>`
- `TodoItem` where `writerID == <TodoMate UID>`
- `Diary` where `writerID == <TodoMate UID>`

Todo history is requested with the ownership filter only; the importer must not require the
user to guess a date range or scrape one day at a time. Firestore Security Rules remain the
authority for which records the account may read.

The implementation relies on TodoMate's current web/Firebase schema, which is not a public
stable API. A schema/rule change must fail visibly without writing partial Mosaic data.

## Mapping

### Goals → categories

- `id` → source category ID
- `title` → category name
- ARGB `color` → Mosaic `#RRGGBB`
- ascending TodoMate `priority` → contiguous Mosaic category `order`
- `isPublic == true` → `public`
- `isViewerIDsFollowers == true` → `followers`
- otherwise → `private`

Finished TodoMate goals are still imported when they own historical tasks.

### Todos → tasks

- `content` → title
- `goalID` → category
- `date` UTC-midnight milliseconds → `YYYY-MM-DD`
- `isDone` → completed
- `doneTime` → completion timestamp
- `memo` → memo
- `remindAt` → ISO reminder timestamp
- `routineID` → routine reference
- `createTime` → created timestamp
- Firestore document `updateTime` → updated timestamp
- source → `todomate`

TodoMate permits undated tasks while Mosaic currently requires a calendar date. To avoid
silently losing those tasks, the import preview counts them and the generated migration
places them on the local calendar day on which the preview was created.

TodoMate task photo URLs are migrated through Mosaic's existing backup/restore image path
rather than being stored directly in the task `image` field. During preview, Mosaic attempts
to download each HTTPS `photoURL` directly in the browser with credentials omitted and no
referrer. If a Google/Firebase Storage URL returns 401/403, Mosaic may retry that same Google
Storage URL with the already-held TodoMate Firebase ID token; the token is never attached to
an arbitrary photo host.

Successfully downloaded images are compressed locally to WebP, given deterministic source
image IDs derived from the TodoMate task and stable photo URL path, bundled into the in-memory
migration ZIP, and then uploaded by Mosaic's existing restore engine into the signed-in user's
own Appwrite Storage bucket. The TodoMate ZIP stores those already-compressed WebP payloads without another deflate pass.
The generated backup uses TodoMate's reserved source-user prefix, so restore can upload those
adapter-produced WebPs directly instead of compressing them a second time. Normal Mosaic backup
images keep the standard compression path. The task is rewritten to the resulting Mosaic-owned
file ID.

Photo preparation is bounded to four concurrent downloads and rejects invalid/non-HTTPS,
non-image, empty, or over-20 MiB source responses. Unavailable photos are reported in preview
without aborting the rest of the migration. A later re-import can retry them. Because photo
download/compression happens during **Preview Transfer**, accounts with many attachments may
spend noticeably longer in the preview step; progress is reported as photos complete. No
Appwrite photo write occurs until the user confirms **Import into Mosaic**.

This is intentionally idempotent. The restore engine already permits an equal-version
cross-account task to run again when the current Mosaic task is missing its portable image,
so users who imported TodoMate before photo support can rerun the migration to fill photos
without duplicating their existing tasks.

TodoMate routine references are preserved on imported tasks, but Mosaic does not currently
have a routine-definition collection to reconstruct TodoMate's recurring rules. The preview
reports how many distinct routine references were found.

### Diary → diary

- TodoMate date → Mosaic date
- emoji + body → Mosaic content
- sharing flags → Mosaic `public`, `followers`, or `private`
- TodoMate create/document timestamps → Mosaic create/update timestamps

The remote Diary schema must contain both `created_at` and `updated_at`. The importer
writes a local Diary row first, then normal RxDB replication sends both timestamps to
Appwrite. If `created_at` is missing from the Appwrite table, the local import can appear
successful while Diary replication retries forever and Sync Status remains one group short.
Treat that as backend schema drift, not as a reason to drop the imported diary entry.

TodoMate selected-viewer sharing cannot be represented exactly by Mosaic's current three-way
visibility model. Such records import as `private`, never as broader visibility.

## Mosaic write semantics

The TodoMate adapter produces an in-memory Mosaic user-backup v2 file and passes it to the
existing personal restore engine in **Merge** mode.

This is deliberate. Restore planning resolves each collection's existing IDs in one RxDB
find-by-ID batch instead of one serial lookup per imported row. Photo restore uses a bounded
four-worker pool; the normal per-image authenticated-user check and deterministic Storage IDs
remain in place, so concurrency does not weaken account isolation or re-import idempotence.

For the large task push that follows a fresh TodoMate restore, a side-effect-free TodoMate task
with no pending local image or reactions may optimistically call Appwrite create first. Success
avoids the predictable getRow -> 404 round trip that every brand-new imported task previously
paid. A create conflict is immediately converted back into the existing remote-read/bootstrap
comparison path, so an already-existing row, a newer master, ownership validation, pending-image
handling, and server reaction preservation keep their established semantics.

This is deliberate. The existing restore path provides:

- online successful-sync preflight before writes
- current-account ownership enforcement
- schema and length validation before application
- deterministic cross-account task/category IDs
- category-reference rewriting
- re-import idempotence
- newer Mosaic rows/tombstones winning over older imported versions
- categories-before-tasks local application with account-generation guards
- an adaptive bounded post-apply freshness barrier with separate synced and sync-pending outcomes

The TodoMate importer must not expose Replace Personal Data. A migration from an external
service is additive and must not delete unrelated Mosaic data.

## Preview and failure behavior

Preview reads TodoMate but performs no Mosaic writes. It reports at minimum:

- category count
- task count
- diary count
- undated tasks that will be placed on today
- TodoMate photo attachments found, ready to copy, and unavailable
- distinct routine references whose recurring definitions are not recreated

Only after preview can the user start the Merge import. Closing or reopening the sheet
cancels the old preview work, and an older attempt cannot overwrite the current preview.
A completed preview is also bound to the Mosaic account that created it. Import refuses to
apply prepared TodoMate data under a different Mosaic account and clears that stale preview,
so the user must preview again under the active account.
Both preview and import expose phase text plus a coarse percentage: preview advances through
connection/login/history/photo preparation; import advances through validation, freshness
preflight, photo copy, exact local-row application, and the six collection-level cloud
freshness proofs. The percentage is progress through those known phases/rows/collections,
not a byte-transfer estimate.

Starting Import records small account-scoped recovery metadata: expected counts, start time,
and whether local application finished. If the app exits during preflight or while rows are
being applied,
reopening the importer explains that the prior run was interrupted and directs the user to
preview and rerun it. Deterministic IDs and Merge semantics keep that rerun duplicate-safe.
If all rows were applied but the bounded final sync did not converge, Mosaic reports
**imported locally · sync pending** instead of **import complete** and preserves the local
rows for normal replication. The final proof uses a 90–300 second budget scaled by the
number of imported personal-data rows rather than the old fixed 30-second budget. All six
independent RxDB freshness proofs start together so a slow earlier collection cannot consume
the deadline and falsely make a later collection (for example diary) look broken.

Any authentication, Firebase configuration, Firestore read, decoding, validation, Mosaic
sync-preflight, or pre-local-completion restore error must be shown as a failed import. Do
not describe partial TodoMate reads or unverified remote convergence as a complete migration.

## Compatibility evidence and maintenance

The current mapping was implemented from TodoMate's public web Firebase configuration and
independently published reverse-engineering work that documents the `Goal`, `TodoItem`,
and `Diary` collections and field semantics. Those findings are compatibility evidence,
not a contract from TodoMate.

Relevant public research:

- https://github.com/3x-haust/todomate-api
- https://github.com/mathix420/todomate-mcp

When TodoMate changes, prefer updating this narrow adapter rather than adding TodoMate
semantics to Mosaic's database/sync layers.

## Acceptance

Automated coverage must prove:

1. CORS-blocked Firebase config discovery falls back to TodoMate's pinned public web config;
2. login is sent only to Google's Firebase Identity Toolkit endpoint;
3. history reads are sent only to TodoMate's Firestore project;
4. no third-party migration proxy is used;
5. Firestore queries use the authenticated owner filter and do not require a date filter;
6. category/task/diary mapping and warnings are deterministic;
7. a rejected TodoMate login performs no history reads;
8. TodoMate photo bytes are bundled with deterministic image IDs and mapped onto the source
   tasks;
9. an arbitrary photo host never receives the Firebase bearer token, while a Google Storage
   401/403 may be retried with that token;
10. the UI clears the password after preview and imports only through Merge restore;
11. closing/reopening Preview cancels the older request and stale preview results cannot win;
12. account changes stop restore application, categories apply before tasks, and large
    1,000–5,000-task fixtures retain every row;
13. failed final convergence keeps locally applied rows and reports sync pending, while a
    deterministic rerun remains duplicate-safe;
14. a preview prepared under one Mosaic account cannot be imported after switching accounts;
15. TodoMate-prepared WebPs skip the second compression pass and photo restore stays bounded
    to four concurrent workers;
16. a fresh TodoMate task push can create without a preliminary getRow miss, while create
    conflicts fall back to the existing bootstrap/conflict behavior.

Live acceptance requires a real TodoMate account and must be done by the user locally. Never
ask the user to paste TodoMate credentials or Firebase tokens into an AI chat. Verify preview
counts against the TodoMate account before approving the import, then spot-check historical
completed/incomplete tasks, categories, memos, reminders, and diary entries in Mosaic after
sync.


## Accepted live result

The first real-account acceptance completed successfully on the stable
`feature/todomate-importer` Preview after the CORS fallback fix.

Observed preview:

- 505 tasks
- 13 categories
- 1 diary entry
- 3 undated tasks placed on the local import day
- 37 TodoMate task photo attachments reported and skipped by the original v1 importer

The user completed **Import into Mosaic** successfully. The migration remained Merge-only and
the known first-version limitations (photo attachment copying and recurring routine-definition
reconstruction) remained explicit rather than being silently widened or guessed.


## Photo migration enhancement

After the initial accepted migration, photo copying was added as an additive enhancement.
The user's previously imported TodoMate tasks do not need to be deleted. Re-running the
import with the photo-capable build will reuse the same deterministic task IDs and only
update equal-version tasks whose Mosaic image field is still empty.

Automated acceptance covers direct public photo download, ZIP bundling, deterministic image
references, secure Google Storage bearer-token retry, partial photo failure reporting, and
the existing equal-version image retry in the restore engine.

Real-account photo preview has now confirmed **37 of 37** TodoMate photo attachments are
downloadable and ready to copy. The first photo import attempt stopped before any restore
writes because Mosaic's restore safety preflight encountered an already-running sync. That
live finding exposed two sync/restore issues outside the TodoMate adapter: the generic sync
engine pushed large dirty sets strictly serially, and restore treated the ordinary
coalescing `initializeSync()` trigger as though it were an awaitable freshness barrier.
The sync engine now has bounded four-worker row pushes and restore uses `refreshSync()` to
wait for the current same-tab coordinator to drain before running one genuinely fresh legacy
cycle. Collections already migrated to RxDB replication are also awaited through their
leader-owned `awaitInSync()` barrier. During that preflight the import may remain on
**Refreshing current data…** while existing work finishes. If another Mosaic tab owns RxDB
leadership, or the bounded preflight cannot settle, Mosaic fails the import and asks the user
to close the other tab/retry rather than continuing with stale data.

Hosted re-acceptance subsequently confirmed the import itself succeeds: all 37 prepared
TodoMate images were copied onto the existing imported tasks without duplication and Mosaic
sync completed.

Large imports intentionally get a bounded convergence budget that scales with restored row
count and caps at five minutes. Live 505-task acceptance measured task replication at roughly
430ms per remote write, so the budget uses 500ms per restored row rather than the earlier
250ms estimate. The final freshness UI must name whichever groups remain (for example
`Waiting for Tasks` or `Waiting for Messages`) instead of only showing a generic count.
If that bounded proof expires, locally applied/imported rows remain durable and live RxDB
replication continues in the background; the user sees the named pending groups and can
confirm later with Sync Now. Opening those migrated task photos then exposed a separate viewer regression:
`ImageViewer` reported every source to PhotoSwipe as 1920×1080, horizontally stretching
portrait/square images. The viewer contract now requires real intrinsic dimensions, with a
behavioral regression test proving a 720×1280 source is opened as 720×1280 rather than 16:9.
Hosted visual acceptance of that viewer repair remains before this enhancement is marked
complete.
