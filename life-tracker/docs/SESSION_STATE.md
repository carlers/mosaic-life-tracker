# Session checkpoint

Updated: 2026-09-28

Current task: fix Samsung/Android Back leaving stale task-photo viewer state after the
PhotoSwipe overlay disappears.

Stable Preview branch: `feature/todomate-importer`.
Working branch: `chatgpt/imageviewer-samsung-back`, based on stable
`45c35d7c0861a7083dd6ee526f6ad50b008b6154`.

## Live evidence
- TodoMate photo migration succeeded for all 37 prepared attachments on the existing tasks.
- The task-photo aspect-ratio fix is already on the stable Preview.
- On Samsung, pressing Back while a task photo is open removes PhotoSwipe from the screen
  but does not clear Day View's viewer state. Opening Day View again resurrects that photo.
- Closing through PhotoSwipe's X or vertical swipe does clear the viewer normally.

## Root cause
Day View itself participates in Mosaic's BottomSheet browser-history stack, but
`ImageViewer`/PhotoSwipe did not own a nested history entry.

With the viewer open, Samsung Back therefore consumed the Day View sheet's history layer.
The parent viewer was torn down visually as the sheet closed, but
`isImageViewerOpen`/`viewingTaskId` remained set in Day View state. Reopening Day View
mounted the viewer again from that stale state.

## Fix
- `ImageViewer` now pushes one viewer-specific browser-history guard above the Day View
  sheet when it opens.
- A browser/Android `popstate` below that guard calls the existing Day View `onClose`
  callback, clearing `isImageViewerOpen` and `viewingTaskId`.
- PhotoSwipe X and vertical-dismiss close through `history.back()` when the viewer guard
  is active, so all close paths consume the same modal history layer rather than leaving a
  dead Back step.
- The underlying BottomSheet guard is preserved; expected order is viewer → Day View → route.
- Aspect-ratio behavior and photo data/storage are unchanged.

## Regression evidence
`tests/components/ImageViewer.test.tsx` now verifies that a browser Back transition from
the viewer guard to the existing Day View guard invokes the viewer close callback while
preserving the Day View history state.

Behavioral-red:
- `e58293c42b740e0fb0caad7faee1a8149b8889bd`
- Quality Gate 1340 failed as intended because the viewer created no
  `__mosaicImageViewerGuard`.

Focused green:
- `e606d6195a2b111d5c392e82fbbee2afbc28f7f7`
- Quality Gate 1341 passed focused verification.

## Contract
`PROJECT_REFERENCE.md` §2 now requires the photo viewer to be the top Android/browser Back
layer above Day View. One Back closes the viewer state only; the next Back may dismiss Day
View. X/swipe-down consume that same viewer layer.

## Remaining
1. Run exact-SHA full canonical acceptance.
2. Squash-deliver the accepted fix into `feature/todomate-importer`.
3. Verify the stable Vercel Preview is READY.
4. Manual Samsung acceptance: open Day View → open photo → press system Back. The photo
   viewer should close while Day View remains open; closing/reopening Day View must not
   resurrect the photo.
5. Promotion of `feature/todomate-importer` to `dev` remains an explicit user decision.

Next action: full-gate this exact viewer Back fix, deliver the stable Preview, then run the
single Samsung Back acceptance check.
