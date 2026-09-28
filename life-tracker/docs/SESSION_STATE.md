# Session checkpoint

Updated: 2026-09-28

Current task: complete hosted live acceptance for TodoMate task-photo migration on stable
Preview branch `feature/todomate-importer`.

Status: photo migration was squash-delivered to `feature/todomate-importer` at
`cc681f4fd6afc6a0279aa90115aadbbbb46613ea`. Exact task SHA
`2c3bc7a675b5d011ad876980bd02e057ee21118a` passed full Quality Gate 1287, and stable
Preview SHA `cc681f4fd6afc6a0279aa90115aadbbbb46613ea` passed full Quality Gate 1288.
The first Vercel Git deployment for that stable SHA failed during its remote `npm run build`
despite the same SHA building successfully in canonical GitHub CI. Vercel's connected
build-log/redeploy actions are unavailable in the current tool session, so this documentation
checkpoint is being delivered through the normal PR path to trigger one clean Git-integrated
Preview retry without inventing a runtime change.

## Accepted base migration
- Real-account TodoMate import already succeeded with 505 tasks, 13 categories, and
  1 diary entry.
- 3 undated TodoMate tasks were placed on the import day.
- The original accepted importer reported 37 TodoMate task photo attachments but did not
  copy them.
- The migration remains read-only toward TodoMate and Merge-only toward Mosaic.

## Photo migration behavior
- Preview attempts each imported task's HTTPS `photoURL` directly in the browser with
  credentials omitted and no referrer.
- If a Google/Firebase Storage URL returns 401/403, only that Google Storage URL may be
  retried with the already-held TodoMate Firebase ID token. Arbitrary photo hosts never
  receive that token.
- Downloads are limited to four concurrent workers and reject invalid/non-HTTPS,
  non-image, empty, or over-20 MiB responses.
- Successfully downloaded photos are compressed locally to WebP and bundled into the same
  in-memory Mosaic migration ZIP under deterministic source image IDs.
- Mosaic's existing restore-image path uploads those bytes into the signed-in user's own
  Appwrite Storage and rewrites the task to the resulting Mosaic-owned file ID.
- Preview reports photo attachments found / ready / unavailable. Unavailable photos do not
  block the rest of the import and may be retried later.
- Import completion feedback reports copied and missing photos.
- No TodoMate photo URL, photo bytes, or Firebase token is routed through a third-party
  migration proxy or Mosaic backend.

## Existing-user retry behavior
- The user's original 505 TodoMate tasks do not need to be deleted or duplicated.
- Restore regression coverage already proves that an equal-version cross-account task may
  be retried when its current Mosaic image field is empty.
- Re-running the photo-capable importer therefore fills images on matching already-imported
  tasks while ordinary equal-version rows continue to be skipped.
- Deterministic image source IDs use the TodoMate task ID plus stable photo URL path, so a
  signed query-token rotation does not by itself create a second image identity.

## Verification
- Focused Quality Gate 1284 passed the final runtime tests before full-gate review.
- Full Quality Gate 1285 caught one ESLint issue in the photo-fetch error path; it was fixed
  at `c5b45e50d56a800cd4a8df9e9d15d3f1161bb9ff`.
- Focused Quality Gate 1286 passed that fix.
- Exact task full Quality Gate 1287 passed at
  `2c3bc7a675b5d011ad876980bd02e057ee21118a`.
- Stable Preview full Quality Gate 1288 passed at
  `cc681f4fd6afc6a0279aa90115aadbbbb46613ea`.
- Automated coverage pins direct photo bundling, unavailable-photo behavior, Google Storage
  token scoping, no-token arbitrary-host requests, UI photo counts, and the pre-existing
  equal-version image retry contract.

## Remaining
1. Deliver this checkpoint through the stable Preview PR path, causing a second Vercel Git
   deployment attempt.
2. Verify the stable branch deployment is READY. If Vercel fails again, the blocker is
   provider-side build visibility/redeploy access and the user must use Vercel's build view
   or Redeploy control to expose/retry the remote build.
3. Once hosted-ready, the user reruns **Preview Transfer** with their own TodoMate account
   and reports photo found/ready/unavailable counts; do not ask for credentials or photo URLs.
4. If readiness is sane, the user reruns **Import into Mosaic**. Existing imported tasks
   should gain Appwrite-hosted photos without duplication.
5. Spot-check several restored photos and sync; then mark the photo enhancement complete.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` is live at `0 11 * * *` with the accepted read-only deployment.
- External GitHub stale-backup monitoring still requires default-branch delivery/configuration;
  do not promote to `main` without explicit user authorization.

Next action: merge this checkpoint to `feature/todomate-importer`, verify the resulting
Vercel Preview retry, then run real-account photo acceptance.
