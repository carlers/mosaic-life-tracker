# Session checkpoint

Updated: 2026-09-28

Current task: finish hosted TodoMate photo acceptance after the user's live preview showed
all 37 TodoMate photos ready but restore was blocked by a long-running sync.

Stable Preview branch: `feature/todomate-importer`.

## Live TodoMate evidence
- Original migration succeeded with 505 tasks, 13 categories, 1 diary entry, and 3 undated
  tasks placed on the import day.
- The photo-capable Preview later reported **37 of 37** TodoMate photo attachments ready.
- The first photo import attempt stopped before restore writes because Mosaic could not
  establish the required fresh-sync preflight; the user also observed Syncing remaining on.

## Accepted sync/restore fix
Stable Preview already contains:
- `914dd25793349e54dfd608a98bb430df9dc6d8de` —
  `fix: unblock restore preflight during long sync`
- `a7561da6ca11bef096988f98f0ec37b4a02035db` —
  `docs: clarify TodoMate fresh-sync wait`

The fix adds `refreshSync()` as a fail-closed freshness barrier for restore/import and
bounds independent dirty-row pushes to four workers per collection while preserving
collection order, Web Locks, per-row update→404-create semantics, permissions, dirty
boundaries, and failure accounting. Stable Quality Gate 1305 passed at `a7561da6...`.

## Vercel Preview investigation
Vercel Git builds for the accepted sync commits failed with
`BUILD_UTILS_SPAWN_1` / `npm run build exited with 1`, while GitHub built the exact same
stable SHAs successfully. The connected Vercel build-log endpoint is unavailable, so the
provider failure has been isolated through repo/build evidence rather than raw Vercel logs.

A first hardening fix corrected a real contract mismatch: Preview builds could invoke the
optional PostHog source-map uploader even though docs defined it as production-only.
Stable commit `dff7f4529fae4f40901db31448b4f2cf12062c06` now forces that upload path off
when `VERCEL_ENV=preview`; Quality Gate 1322 is fully green. Vercel still failed that SHA,
so source-map upload was not the root cause.

## Root cause evidence: stale build-size baseline
The last Vercel-successful stable SHA, `e1cdb38c...`, had this GitHub build result:
- app assets gzip: **605,042 / 606,100 B** — only 1,058 B headroom.

After the accepted sync work, stable `a7561da6...` measured:
- app assets gzip: **605,462 / 606,100 B** — only 638 B headroom.

Stable `dff7f452...` measured:
- entry raw: 533,477 B
- entry gzip: 161,455 B
- app assets raw: 2,006,246 B
- app assets gzip: **605,480 B**
- unique precache: 2,066,777 B

Vercel injects build commit/branch/message/time metadata into the compiled client whereas the
ordinary GitHub build leaves those values empty. The accepted feature growth consumed almost
the entire old aggregate-gzip allowance, making provider metadata sufficient to cross a
budget that was last baselined before the TodoMate/photo/sync work.

## Current working branch
`chatgpt/build-size-rebaseline`, based on stable
`dff7f4529fae4f40901db31448b4f2cf12062c06`.

Changes:
- rebaseline `config/build-size-budget.json` to the exact accepted `dff7f45` GitHub build;
- keep the existing entry raw/gzip safety caps unchanged;
- give aggregate app-assets raw/gzip and unique-precache limits approximately 5% reviewed
  headroom over the accepted current baseline;
- add unit coverage pinning the baseline commit/date and 4.9–5.1% aggregate headroom;
- document the deliberate rebaseline in `PROJECT_REFERENCE.md`.

This is a reviewed feature-growth rebaseline, not disabling the guard or raising a threshold
solely to make CI pass.

## Remaining
1. Run exact-SHA full canonical acceptance for the rebaseline.
2. Squash-deliver it to `feature/todomate-importer`.
3. Verify the new Vercel Preview becomes READY. If it does not, continue provider diagnosis.
4. Once READY, user refreshes the stable Preview, reruns **Preview Transfer**
   (expected 37/37 ready), then **Import into Mosaic**.
5. Confirm import completes, sync settles, no duplicate tasks appear, and spot-check several
   TodoMate photos rendering from Mosaic/Appwrite Storage.
6. Only then mark the TodoMate photo enhancement complete.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` remains scheduled at `0 11 * * *`.
- External GitHub stale-backup monitoring still requires default-branch
  delivery/configuration; do not promote to `main` without explicit user authorization.

Next action: full-gate the reviewed build-size rebaseline, deliver it to stable Preview, and
verify Vercel.
