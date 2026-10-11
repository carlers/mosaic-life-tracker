# Session checkpoint

Updated: 2026-10-11 UTC
Current task: #405 Bucket List v0.19.2 — linked-task photo viewing.

## Status and scope
- User confirmed v0.19.1 local `syncMeta` DB6 migration works and requested the ability to **see existing photos attached to tasks** while viewing linked tasks in a Bucket List aspiration.
- Stable base `feature/bucket-list-405@0a5b220311e81bac02b556d911ea6d2b198652bd`, v0.19.1. Approved Scratch migration 011 and combined `message-action@6acbb81e4a02f7368340` already live; **no backend changes required or authorized** for this UI-only follow-up.
- Task branch `chatgpt/bucket-list-linked-task-photos-405-20261011` targets v0.19.2: show 64px task-image thumbnails only for linked tasks with `task.image`. Reuse `useImageLoadGate` + `useTaskImage` and existing lazy `ImageViewer` PhotoSwipe overlay. Cached/offline/pending semantics belong to existing hooks. Tapping photo opens fullscreen with title and date while task row tap, completion, and unlink behavior are unchanged. Missing images show a fallback and no destructive retries.
- Current dev/master not touched. Schema/migrations, remote Appwrite rows/buckets, and attachments are unchanged.

## Next action
- Accessible DOM tests cover loaded thumbnails, click-to-view, deferred loads, unavailable/missing/loading photos and live attachment identity changes. Run focused CI, repair, squash to stable, exact canonical CI + Vercel READY. Confirm previously deployed Scratch Function unchanged. Then user can test on the stable registered Preview alias; no dev/main promotion until approved.
