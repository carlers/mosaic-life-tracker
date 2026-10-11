# Session checkpoint

Updated: 2026-10-12
Current task: Cross-device task-photo authenticated downloads (user-approved Preview bug fix).

## Objective and isolation
- Fix photo download failures on phone/desktop when third-party cookies are blocked. The prior raw fetch sent credentials but omitted Appwrite's X-Fallback-Cookies session header; task-sync and per-photo Retry cannot repair that HTTP authorization failure.
- Base dev: `5ec3f3f2250beacf55cd9c23a7f35d53e68275f2` (v0.17.8). Task branch: `chatgpt/task-photo-authenticated-download-20261012`. Stable Preview: `fix/task-photo-authenticated-download-20261012`. Candidate Preview v0.17.9.
- Add `guardedStorage.downloadFileBlob` using Appwrite SDK `client.prepareRequest` for the fallback session and normal cookie credentials. Demand HTTP 200 before caching; 401 remains distinguishable. Reuse for task thumbnails, full-view cache and photo backup export, without changing bucket permissions or deleting pending offline originals.
- Read-only Appwrite inspection: Production has 89 active task-photo references, every file exists and is authenticated-user readable; Scratch has 46 references, every file exists, with four legacy different permission grants. No Appwrite mutation authorized. Preview is Scratch-only and cannot access real production photos.

## Next action
- Complete one coherent focused task commit with regression tests (SDK session fallback, non-200 handling, cache-bypass recovery, offline staged originals and backup export).
- After focused CI passes, squash PR into stable Preview; verify exact stable SHA Quality Gate canonical success, Vercel READY/Scratch identity and build-size guard.
- User must manually test real Android/iOS and two-device photo fetch, including previously unavailable images. No authorization to merge dev/main or touch Production.
