# Session checkpoint

Updated: 2026-09-28

Current task: complete live TodoMate photo re-acceptance on the stable hosted Preview.

Stable Preview branch: `feature/todomate-importer`.

## Live TodoMate evidence
- Original migration succeeded with 505 tasks, 13 categories, 1 diary entry, and 3 undated
  tasks placed on the import day.
- The photo-capable Preview reported **37 of 37** TodoMate photo attachments ready to copy.
- The first photo import attempt stopped before restore writes because Mosaic could not
  establish the required fresh-sync preflight; the user also observed Syncing remaining on.

## Accepted sync/restore fix
Stable Preview contains:
- `914dd25793349e54dfd608a98bb430df9dc6d8de` —
  `fix: unblock restore preflight during long sync`
- `a7561da6ca11bef096988f98f0ec37b4a02035db` —
  `docs: clarify TodoMate fresh-sync wait`

The fix:
- adds `refreshSync()` as a fail-closed freshness barrier for restore/import;
- waits for this tab's queued/running sync coordinator to drain before starting one new
  serialized cycle;
- retains last-sync freshness/error checks;
- bounds independent dirty-row pushes to four workers per collection while preserving
  collection order, Web Locks, per-row update→404-create semantics, permissions, dirty
  boundaries, and failure accounting.

Stable Quality Gate 1305 passed the sync/restore fix.

## Vercel build investigation and repair
The accepted sync SHAs initially failed only in Vercel with
`BUILD_UTILS_SPAWN_1` / `npm run build exited with 1`, while GitHub built the exact same
source successfully.

Two build-system issues were resolved:

1. Stable `dff7f4529fae4f40901db31448b4f2cf12062c06` prevents Vercel Preview from
   invoking the optional PostHog source-map upload path. Quality Gate 1322 passed.
2. The existing build-size budget had only ~620 bytes of aggregate gzip headroom after the
   accepted TodoMate/photo/sync feature growth. The reviewed aggregate baseline was
   re-established from the accepted stable build while preserving the existing entry caps
   and approximately five percent aggregate headroom.

Stable rebaseline commit:
- `2a9fc29c9580712778dba5b89cfcab2f9000d76e` —
  `chore: rebaseline accepted bundle-size budget`

Verification:
- stable Quality Gate **1327 passed** at `2a9fc29c...`;
- Vercel deployment `dpl_9SLNejNfzzbZMfcFaQ5WQLthPegy` is **READY**;
- the stable feature alias returns HTTP 200 and is serving that deployment:
  `https://mosaic-life-tracker-git-feature-248dfb-carls-projects-72516fde.vercel.app`.

## Remaining live acceptance
No further repository change is required before the user retests.

1. Refresh/reopen the stable Preview so the current deployment controls the page.
2. Open **Settings → Import from TodoMate** and rerun **Preview Transfer**.
3. Expected photo preview: **37 found / 37 ready / 0 unavailable**.
4. Choose **Import into Mosaic**.
5. Confirm:
   - the import completes instead of failing at the fresh-sync preflight;
   - Mosaic sync settles rather than remaining indefinitely on Syncing;
   - no duplicate TodoMate tasks/categories are created;
   - several previously imported tasks now show their TodoMate photos from Mosaic/Appwrite
     Storage.
6. Only after those checks pass, mark the TodoMate photo migration enhancement complete.

Do not ask the user to paste TodoMate credentials, Firebase tokens, or photo URLs into chat.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` remains scheduled at `0 11 * * *`.
- External GitHub stale-backup monitoring still requires default-branch
  delivery/configuration; do not promote to `main` without explicit user authorization.

Next action: user performs the hosted photo-import re-acceptance on the READY stable Preview.
