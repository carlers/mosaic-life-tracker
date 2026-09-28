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

TodoMate task photo URLs are not stored directly in Mosaic's `image` field because Mosaic
requires owned Appwrite Storage file IDs. The first importer version counts and reports these
attachments but leaves the Mosaic image reference empty.

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
- TodoMate photo attachments not copied
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
8. the UI clears the password after preview and imports only through Merge restore.

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
- 37 TodoMate task photo attachments reported and skipped

The user completed **Import into Mosaic** successfully. The migration remained Merge-only and
the known first-version limitations (photo attachment copying and recurring routine-definition
reconstruction) remained explicit rather than being silently widened or guessed.
