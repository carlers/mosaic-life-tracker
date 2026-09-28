# Session checkpoint

Updated: 2026-09-28

Current task: fix task-photo aspect-ratio distortion discovered after successful TodoMate
photo migration.

Stable Preview branch: `feature/todomate-importer`.
Working branch: `chatgpt/imageviewer-aspect-ratio`, based on stable
`8329ce480af9766e27144ba7f516fdeb6c9993f3`.

## Live acceptance state
- Original TodoMate migration: 505 tasks, 13 categories, 1 diary entry.
- Photo preview: **37 of 37** TodoMate attachments ready.
- After the sync/restore fix and Vercel build-budget repair, the user reran the importer and
  reported it **worked perfectly**: the TodoMate photo re-import succeeded on the existing
  tasks.
- The remaining issue is presentation only: opening a migrated task photo from Day View in
  PhotoSwipe stretches portrait/square images horizontally.

## Root cause
`src/components/home/views/ImageViewer.tsx` hard-coded every PhotoSwipe source as:
- width: 1920
- height: 1080

PhotoSwipe therefore laid every source out as 16:9 even when the actual stored WebP was
portrait or square. The issue is independent of TodoMate mapping/storage; any non-16:9 task
photo could be distorted in the viewer.

## Product contract
`PROJECT_REFERENCE.md` §2 now requires the Day View task-photo viewer to use the source
image's intrinsic dimensions. Portrait, square, and landscape photos must preserve their
aspect ratio and must not be forced into a fixed 16:9 frame.

## Regression evidence
A new DOM regression test, `tests/components/ImageViewer.test.tsx`, stubs a portrait
720×1280 image and inspects the PhotoSwipe item dimensions.

Behavioral-red:
- commit `d0b368b46f1aea6d6f5969f4985bc3ca5caff4a0`
- Quality Gate 1331 failed the new test as intended:
  received 1920×1080, expected 720×1280.

Implementation:
- `ImageViewer` now probes the already-resolved task image for its intrinsic dimensions
  before creating PhotoSwipe.
- PhotoSwipe receives the actual width/height.
- If intrinsic dimensions cannot be read, the viewer closes instead of rendering the image
  against fabricated dimensions.
- Existing caption, close gesture, lazy loading, and Day View sheet behavior remain unchanged.

Focused green:
- commit `09796f6f1c2179c4dd9cc05c1f8e3706efedea32`
- Quality Gate 1332 passed focused verification.

## Remaining
1. Review final diff and checkpoint.
2. Run exact-SHA full canonical acceptance.
3. Squash-deliver the accepted fix into `feature/todomate-importer`.
4. Verify the stable Vercel Preview is READY and the stable alias serves it.
5. User opens one portrait/square migrated task photo from Day View and confirms it is no
   longer stretched.
6. If visually accepted, mark the TodoMate photo migration enhancement complete.
7. Promotion of `feature/todomate-importer` to `dev` remains an explicit user decision.

## Separate DR follow-up
- DR work is already merged into `dev`.
- Production `dr_backup` remains scheduled at `0 11 * * *`.
- External GitHub stale-backup monitoring still requires default-branch
  delivery/configuration; do not promote to `main` without explicit user authorization.

Next action: full-gate this exact viewer fix, deliver the stable Preview, and run the single
visual aspect-ratio acceptance check.
