# Task commands — integrated mobile Preview (#1441)

## Scope and release boundary

v0.108.0 integrates the previously reviewed v0.56.0 typed/voice command modules onto the v0.107.3 `dev` application. The Home microphone button is an independent launcher next to Search. Opening it **does not record, download a model, interpret or save anything**. Close or cancel to leave all task data unchanged. The Search control and current Home gesture shortcuts remain independent.

- Type a command such as `Add physics homework to School tomorrow`, `Add buy rice to Errands in backlog`, or a partially complete phrase. Review and edit title, category and date/Backlogs; saving requires a separate explicit Create action. Unknown category creation stays private and owner-only.
- Optional browser speech runs only after informed opt-in and pressing Record. Browser speech services may process microphone audio externally. If unsupported/denied, typed entry remains available; do not claim this mode is offline or private.
- Optional local Whisper Tiny uses an explicit model download and microphone consent, local inference in a worker, a model-cache deletion action, and language choice (English or multilingual); download and decoding require real device tests. No model weights are bundled in Home's initial JavaScript. An optional WebGPU command-suggestion model is a separate opt-in; its output is editable text, never an executable instruction.
- Reviewed bulk commands operate only on currently loaded owner tasks. Match/skip counts and exact task list are shown before execution; bulk writes additionally require a recent successful online sync, selection bounds, typed confirmation, and owner/stale-row checks; undo uses guarded compensating writes, not an atomic database rollback. Do not test on valuable personal data until separately validated on a disposable Scratch account.
- The separate read-only MCP sidecar (`mosaic-mcp-scratch-preview`) remains isolated and unchanged; this UI candidate does **not** deploy or enable MCP writes, Production credentials or backend Functions.

## Manual owner acceptance (Android Brave first)

1. Open Home and tap the microphone button. Confirm no automatic recording/download. Type a single-task command, check title and date, create, and locate it on Calendar; verify incomplete phrases require review.
2. Deny microphone permission and confirm typed fallback. If available, test browser speech with disclosure and stop; then opt into local Whisper on fast connectivity, test cancel and downloaded-model deletion. Verify the app's PWA remains usable offline afterward.
3. Review a bulk command using a disposable Scratch account. Check zero database writes before explicit confirmation; test an invalid/stale selection, Sync Now requirement, cancellation, bounded progress and guarded undo. Never perform mass deletion on actual personal tasks in testing.
4. Check Back gesture/keyboard, Home horizontal/vertical swipes, TOTP login, wallpapers, Light/Dark/Black, task search, user switching during review, offline queued single-task creation/reconnect and PWA update.

## Verification policy

Task commit requires focused CI, then stable Preview exact-SHA canonical acceptance (build and strict initial/Home budgets, DOM and browser shards), official Oracle Scratch Vercel READY and registered alias readback. Real phone voice performance and cloud processing are not proven by CI. Appwrite schemas, Function deployments, Scratch MCP sidecar, dev/main and Production remain untouched by this Preview. A separate future owner approval is required for promotion.
