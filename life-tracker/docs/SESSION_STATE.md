# Session checkpoint

Updated: 2026-09-28

Current task: extend the accepted TodoMate → Mosaic migration so TodoMate task photos are
copied into Mosaic's own Appwrite Storage and can be filled onto already-imported tasks.

Status: the original importer is live-accepted on stable Preview branch
`feature/todomate-importer`. Photo work is isolated on
`chatgpt/todomate-photo-import`, branched from stable Preview SHA
`f2ce2f65c275c39d28feb7ed7f0eab4ee239c624`.

## Existing accepted migration
- Real-account import succeeded with 505 tasks, 13 categories, and 1 diary entry.
- 3 undated TodoMate tasks were placed on the import day.
- The original v1 preview reported 37 TodoMate photo attachments but did not copy them.
- TodoMate remains read-only and application remains Merge-only through Mosaic's existing
  restore engine.

## Photo migration implementation
- Preview now attempts to download each HTTPS TodoMate `photoURL` directly in the browser
  with cookies/credentials omitted and no referrer.
- If a Google/Firebase Storage URL returns 401/403, only that Google Storage URL may be
  retried with the TodoMate Firebase ID token. Arbitrary photo hosts never receive the token.
- Invalid/non-HTTPS, non-image, empty, over-20 MiB, or otherwise unavailable photos are
  reported as unavailable without blocking the rest of the migration.
- Photo downloads use at most four concurrent workers.
- Successfully fetched photos are compressed locally to WebP and bundled into the same
  in-memory Mosaic migration ZIP under deterministic source image IDs.
- The task `image` reference points to the bundled source image ID; Mosaic's existing
  restore-image path uploads the bytes to the current user's Appwrite Storage and rewrites
  the task to the resulting Mosaic-owned file ID.
- Preview now reports photo attachments found / ready / unavailable.
- Import completion feedback reports copied and missing photos.
- No TodoMate photo URL/token/content is logged or sent through a third-party migration
  proxy or Mosaic backend.

## Idempotent re-import
- Existing restore coverage already proves an equal-version cross-account task may be
  retried when its current Mosaic image field is empty.
- Therefore the user's already imported 505 tasks do not need to be deleted or duplicated.
  Re-running the photo-capable TodoMate import can fill missing images on matching tasks.
- Deterministic source image IDs use the TodoMate task plus stable photo URL path so signed
  query-token changes do not create new source IDs.

## Automated verification
- Focused Quality Gate 1284 passed the final runtime/tests at
  `706a0c36a71e378a36bebcdd376d5531a09e388b`.
- Coverage pins direct photo bundling, partial/unavailable-photo behavior, and the credential
  boundary: public/arbitrary photo downloads receive no Firebase token; a Google Storage
  401/403 retry may receive the Firebase ID token.
- A final exact-SHA full canonical gate is required on the final checkpoint tip before
  stable Preview delivery.

## Remaining
1. Complete diff review and final exact-SHA canonical acceptance.
2. Squash-deliver the accepted change into `feature/todomate-importer`.
3. Verify the replacement Vercel Preview is READY.
4. User reruns **Preview Transfer** with their own TodoMate account and reports the photo
   found/ready/unavailable counts; do not ask for credentials or photo URLs in chat.
5. If photo readiness is sane, user reruns **Import into Mosaic**. Existing imported tasks
   should gain their Appwrite-hosted photos without duplication.
6. Spot-check several restored photos and sync; then mark the photo enhancement complete.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` is live at `0 11 * * *` with the accepted read-only deployment.
- External GitHub stale-backup monitoring still requires default-branch delivery/configuration;
  do not promote to `main` without explicit user authorization.

Next action: finish final review, request full canonical acceptance on the exact task tip,
deliver to the stable TodoMate Preview branch, and run real-account photo acceptance.
