# Session checkpoint

Updated: 2026-10-11
Current task: Fix cross-device task photo downloads on browsers where Appwrite sessions use fallback cookies.

## Objective and isolation
- User accepted implementation after observing that phone uploads appeared on laptop but laptop uploads and older photos failed on phone; Retry and Sync Now did not help.
- Start from verified dev `5ec3f3f2250beacf55cd9c23a7f35d53e68275f2` (v0.17.8) on task branch `chatgpt/task-photo-authenticated-fetch-20261011`. Stable Preview destination `fix/task-photo-authenticated-fetch-20261011`, candidate v0.17.9.
- Root cause: task photo downloads and backup export used raw cross-origin fetch with cookies and project header but omitted the Appwrite Web SDK's `X-Fallback-Cookies` authentication on browsers that restrict third-party cookies.
- Keep photo storage file-level security and owner-only writes, preserve offline/pending originals and valid cached image blobs, reject partial and empty downloads. Reuse SDK request preparation in the guarded storage boundary for both UI and backup export.
- No Production Appwrite updates, backend schema changes, or dev/main promotion. Automated tests cannot replace actual Android/iOS PWA acceptance.

## Next action
- Task-branch coherent commit with focused CI, then squash into stable Preview only after focused green, and verify full canonical CI, exact-SHA Vercel Scratch deployment and registered test alias.
- Test laptop-to-phone, phone-to-laptop, older photos after app restart, cached-photo Retry and backup with real devices. If photos remain inaccessible after the auth fix, capture status/error category; do not delete originals or broaden storage permissions.
- Respect independent manual authorization before any Preview-to-dev/main promotion.
