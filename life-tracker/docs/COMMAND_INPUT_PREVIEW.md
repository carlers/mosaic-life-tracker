# Natural-language command Preview (issue #1441)

**Initial candidate:** v0.52.0; based on current dev v0.50.3 with the validated standalone parser ported into a lazy Home sheet.

## Test manually

On the Home page, tap the **sparkle/wand icon beside Search** (not the Search icon). Enter a phrase such as:

- add go to school to errands for tomorrow
- Add learn to code to Projects next Friday
- Paki-add buy rice sa Errands bukas
- Add laundry to Home in backlog
- Add review math to School in 3 days

Tap **Review command**, check or edit title, category and date (or check **Put in Backlogs**), then tap **Create task**. Only final confirmation calls Mosaic's existing owner-local task creation hook. Backlogs tasks default to private; dated tasks preserve the existing default visibility and Add Tasks to Top preference. Dates are interpreted using the device's current local date, not the benchmark's fixed October 31, 2026 clock.

Unknown or incomplete instructions permit manual entry for *a single task*. Bulk/unsupported instructions such as Move all tasks from School to Backlogs cannot be executed or converted to creation. The sheet does not record voice, call a hosted AI model, modify categories, or run batch updates. This icon is a command launcher, not a microphone.

## Scope and verification

No RxDB/schema/Appwrite changes; no backend key or hosted API; no model weights. Chrono-node 2.10.3 loads with the command sheet rather than initial Home rendering. Existing Home search and swipe flows remain unchanged. The parser uses only the signed-in owner's current category names and verifies the category ID again at write time.

Unit regressions run 30-, 88- and 40-case synthetic fixture sets; these are **not** representative of real-user language accuracy. Tests cover review/confirmation, account switching, unsupported commands, dates, and category ownership.

**Manual checks remaining:** Android installed PWA input/date picker, physical Back gesture, offline typed creation and sync after reconnection, switching accounts with an open review, and verifying the created task appears under the intended date/category. No dev/main/Production promotion without explicit approval.


## Preview refinement v0.52.1 — partial tasks, categories and voice

- The command sheet now uses the existing MosaicSelect category dropdown, rather than a native browser select. Existing owner categories retain their colors.
- Partial phrases such as \`add do physics to school\` prefill title \`do physics\` and the existing \`School\` category, leaving the date **unset**. The task cannot be saved until the user chooses Today, Tomorrow, a custom calendar date, or Backlogs. Missing information never silently defaults to a new date.
- Unknown category phrases such as \`add review galaxies to Astronomy tomorrow\` create a **draft** containing a suggested new category. Selecting **Create new category…** allows editing its name. Confirming the task creates a default private category first, then creates the task; neither action occurs during parsing or preview. If category creation succeeds but task creation fails, the category may remain and will be reused by name on retry. Other Mosaic category settings can be edited in the usual Category Manager.
- An optional **Speak command** action uses browser SpeechRecognition only after the user checks an explicit warning/consent control. **Browser providers may process audio on external servers, and recognition may not work offline.** This is not locally run Whisper and not a guarantee of Taglish accuracy. The browser owns the microphone prompt, no voice upload or remote NLP integration is implemented by Mosaic, transcript remains editable, and recording can be stopped. Browser support varies; typed entry always remains available. Voice is stopped on dismissal and component unmount.
- Only single-task creation is enabled. Edit/move/bulk/delete operations remain unavailable. All new categories and tasks are owner-scoped and category names are matched case-insensitively.
- User acceptance checks: test Chrome Android and installed PWA permission and unsupported-browser fallback, deny permission, Android Back while listening, turn offline during input, partial command missing date, create a new private category, retry a failed task write, confirm task appears under expected day/Backlogs. No assertion of production speech performance without device testing.


## Microphone permissions repair — v0.52.2 Preview

Root cause: the app and trusted static Preview routing config both sent a Permissions-Policy header with microphone=(), denying microphone even when the user wanted to grant access. The corrected directive microphone=(self) allows the current Mosaic origin to request permission. Camera and geolocation remain denied.

Mosaic now distinguishes not-allowed (microphone/browser security permission denied) from service-not-allowed (the browser's speech recognition provider is unavailable or refused), plus hardware, network and language errors. Allowing the microphone does not guarantee Chrome's browser-hosted speech recognition will succeed on every device. Browser recognition remains opt-in and task writes require explicit review.

### Manual tests on Android and laptop

1. Open the new Preview in a normal Chrome tab rather than an embedded frame, sign in, and visit Home -> Task command.
2. Check speech consent, tap Speak command, and choose Allow in the browser microphone permission prompt.
3. Dictate a simple command. Verify the transcript is editable and task creation still requires review.
4. If microphone access is blocked, allow Microphone for the exact Preview URL in the browser's site settings and retry. Android also needs Chrome OS-level microphone access. Previously denied per-origin permissions may persist after a header fix.
5. If the speech service is blocked, that is distinct from microphone permission. Try the device keyboard's dictation or type the command; no raw microphone audio should be sent to an unapproved endpoint.
6. Test Stop, Android Back, deny permission, offline typing, and the installed PWA. Device-level speech acceptance is outstanding.

Bulk execution is not enabled. See [bulk-command plan](COMMAND_BULK_PLAN.md).


## Brave recognition feedback — v0.52.3 Preview

The microphone header fix in v0.52.2 resolves a site-level permission denial, but does not supply a transcription engine. On Brave desktop, the `webkitSpeechRecognition` / `SpeechRecognition` constructor can be present while the service used for transcription is unavailable. Its `network` callback can therefore indicate **provider incompatibility even with internet access and a working microphone**. Brave's on-device Web Speech support is under active development (brave/brave-browser#56487 as of 2026-11-01); do not promise that every Brave release can run it.

Mosaic now checks Brave's documented `navigator.brave.isBrave()` API as an **advisory only**. It does not use a Chrome-like User-Agent guess or preemptively disable voice for future compatible versions. It displays specific guidance before voice capture and on `network` or `service-not-allowed` events. Browser permission denial still has its original separate guidance. Typed input and the mandatory review/create step remain available regardless of detection.

For browser transcription today, use current Google Chrome with browser microphone permission; for Brave, use any available device/OS keyboard dictation to fill Mosaic's command textarea, or type. No new third-party audio upload, credentials, background recording, Appwrite schema or backend were added.

**Potential future option (not implemented/approved):** opt-in on-device speech-to-text for Brave and other browsers independent of a browser vendor's backend. Requires a sandboxed model/worker, explicit model download and storage/CPU budgets, accessibility/Android memory testing, security review and privacy controls before any integration. Do not silently download language models. Bulk-command execution remains out of scope.


## Local Whisper voice Preview v0.52.4 (experimental)

This version adds a **separate opt-in Local voice** option on the Task Command sheet. The previous browser SpeechRecognition option remains unchanged.

- On Brave desktop: check **Enable optional local model download and microphone recording**, then **Prepare local voice**. The first preparation downloads model files from Hugging Face and an ONNX/WASM runtime from Mosaic; this requires internet access. It does **not** begin recording. Progress and any errors are shown. The quantized `onnx-community/whisper-tiny.en` (q8) version is **different from** the 71 MB model the user tested on the whisper.cpp demo; compatibility is not automatically proven by that demonstration.
- Once the model reports Ready, click **Record locally**, speak for at most 15 seconds, then **Stop and transcribe**. The microphone is released before inference. Audio stays in browser memory and is fed into a dedicated local Web Worker; no audio file is transmitted to Appwrite, Hugging Face or any other API. Only the model files are downloaded; weights are pinned to the immutable HF model revision `2575352d61be1bf7225cf8f8b268a4678025fc58`.
- The resulting transcript is editable. Tap Review command, verify extracted fields, and manually Create task as before. **The engine never performs actions on transcripts automatically.** Cancel or sheet dismissal ends the worker and releases the microphone; no recording state is retained.
- The model is English-only in this initial spike, so Filipino or Taglish accuracy is not established. First download size is roughly **45 MB of model weights**, plus a large WASM runtime and supporting files; confirm actual network transfer on the user device. Low-memory devices can fail. The model may be cached by the browser but **offline availability is not guaranteed**; optional Worker/WASM files are deliberately excluded from the mandatory PWA offline precache. Do not equate this with Mosaic's usual offline-first tasks.
- The runtime is loaded only from an explicit user action and is separated from the startup/Home JavaScript closure. The build enforces that the opt-in Worker and ONNX WebAssembly binaries are excluded from the mandatory install precache while the rest of the app's JS/CSS remains cached.
- If the local model fails, typed commands and the existing browser recognition workflow are unaffected. The app does not offer a cloud audio transcription fallback.

**Verification completed in an isolated sandbox:** pinned model q8 loaded and ran inference with the Node CPU backend; the Vite/PWA build and blocking initial/Home gzip budgets passed, with optional aggregate assets exceeding advisory limits; 27 focused UI/parser/speech tests and project contracts passed. **Not yet verified:** exact browser WebAssembly model loading, real Brave/Android microphone PCM handling, model cache/offline reuse, Taglish quality, real-time speed, device thermals/memory.

**User manual test:** use Brave laptop on the immutable Preview URL, opt in to Local voice, note actual model download/time and transcript accuracy, Stop+Cancel and account logout, and confirm no task is written until Create task. For Android use a short phrase and test that insufficient-memory cases do not corrupt other app functionality.

### CI artifact verification for the optional local runtime

The production bundle contains a self-hosted ONNX Runtime WASM asset of approximately 26.9 MB uncompressed. CI's tar integrity validator retains its ordinary 8 MiB per-file limit but accepts only the hashed `assets/ort-wasm-simd-threaded.asyncify-XXXXXXXX.wasm` path with a 28 MiB ceiling. The existing 32 MiB maximum expanded archive, path/type checks, expected SHA, per-file inventory checksums and non-deployable CI trust boundary remain required. Regression tests reject unrelated large files and an oversized runtime. The opt-in runtime remains excluded from the PWA install precache.

## Optional model deletion — v0.52.5 Preview

The local Whisper controls contain **Delete downloaded Whisper** even when recording consent is disabled. Selecting it stops any ongoing local worker/model preparation, releases microphone capture and removes this Whisper model's browser CacheStorage namespace. The previous v0.52.4 shared Transformers.js cache is selectively cleaned of matching Whisper files without deleting the rest of its contents. After deletion, **Prepare local voice** downloads weights again with explicit opt-in.

The separate reserved `mosaic-local-intent-v1` namespace is for any *future* optional local AI model; such a model must expose its own individual delete/unload button before shipment. No Qwen/other local AI model is bundled or downloaded in v0.52.5.

Deletion is best-effort within the browser-managed Cache Storage API. Browser HTTP caching of static runtime assets and downloaded files outside that storage remain browser-controlled; no task, note, photo, auth, Appwrite or PWA offline cache is cleared. If deletion is blocked, the UI reports the failure rather than claiming success. Manual acceptance: prepare, record, delete, prepare again; test offline and on Brave/Android with actual storage conditions.


## v0.54.0 on-device models

English Whisper remains the default. Choose Multilingual / Filipino to opt into separate
pinned multilingual Whisper weights; switching stops the prior worker. Delete downloaded
Whisper models clears both the English and multilingual model storage and the legacy
Whisper entries only; no task/PWA cache is deleted.

The AI helper is a separate, opt-in Qwen3 0.6B WebGPU model. Prepare AI initiates
the download only after checking consent. Suggest command returns plain editable text;
Use suggestion copies it into the editor, but no task mutation occurs without the
existing Review command and subsequent manual confirmation. Cancel AI unloads the
worker. Delete downloaded AI model unloads it and deletes only its own CacheStorage
namespace. Unsupported WebGPU and failed inference preserve typed commands.
Test permissions, model-download cancellation, offline reuse, deletion and reload,
and model accuracy on physical Brave/Android devices before acceptance.
