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
own Appwrite Storage bucket. The task is rewritten to the resulting Mosaic-owned file ID.

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

TodoMate selected-viewer sharing cannot be represented exactly by Mosaic's current three-way
visibility model. Such records import as `private`, never as broader visibility.

## Mosaic write semantics

The TodoMate adapter produces an in-memory Mosaic user-backup v2 file and passes it to the
existing personal restore engine in **Merge** mode.

This is deliberate. The existing restore path provides:

- online successful-sync preflight before writes
- current-account ownership enforcement
- schema and length validation before application
- deterministic cross-account task/category IDs
- category-reference rewriting
- re-import idempotence
- newer Mosaic rows/tombstones winning over older imported versions
- normal local-first writes followed by Mosaic sync

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

Only after preview can the user start the Merge import.

Any authentication, Firebase configuration, Firestore read, decoding, validation, Mosaic
sync-preflight, or restore error must be shown as a failed import. Do not describe partial
TodoMate reads as a complete migration.

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
10. the UI clears the password after preview and imports only through Merge restore.

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
wait for the current same-tab coordinator to drain before running one genuinely fresh cycle.
Hosted re-acceptance still must confirm the 37 images upload into Appwrite Storage and render
on the existing imported tasks without duplication.
