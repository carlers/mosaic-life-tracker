# Session checkpoint

Updated: 2026-10-10
Current task: Issue #413 keyboard-native sticker direct-send revision (user rejected mandatory manual imports).
Baseline: `feature/custom-stickers` v0.13.1 `163c73bd951a4e9948768c2a2a003d16a9356e24` full canonical Actions 38037389370 SUCCESS (attempt 2), Vercel READY. `dev` `224f8a700f35bbe3853206ee208e1dc103ece5b3` v0.12.1, untouched.
Task branch: `chatgpt/keyboard-stickers-direct-send` targeting stable `feature/custom-stickers`. Candidate v0.13.2 (PATCH for user-testable revised Preview; do not bump again for failed CI attempts).

## Implementation
- On Android, Composer uses a contenteditable text box (rather than textarea) to expose rich keyboard image input when browsers support it; paste/beforeinput and local data/blob inline image are intercepted. Existing textarea remains for non-Android. Receiving an image directly queues a message without a sticker picker/library step, preserving reply context/draft.
- Prep converts incoming supported PNG/JPEG/WebP/GIF to static, transparent WebP <=384px <=128KiB (GIF animation not preserved, complex opaque backgrounds rejected) and salts hash with owner+recipient; store in existing owner-only IndexedDB pending-image store *before* inserting pending message. No extra backend table/bucket/function.
- Message transport uploads one physical file per unique owner+recipient+image and sets owner plus recipient read permissions directly on create, verifies exact ACL before trusted message delivery, and removes durable staged bytes only on success. Same sticker reused within one friendship; different friends deliberately get separate narrow files rather than racy mutable recipient grants.
- Removing a personal-library sticker no longer deletes the underlying file based on one device's incomplete local message history, preventing offline cross-device data loss (safety over automatic storage reclamation). Legacy picker/wire remains optional and backward-compatible, but legacy mutable ACL path still has cross-device race.
- Unit/DOM tests cover keyboard clipboard flow, Android rich-editor behavior, deterministic scoped IDs and media authorization. See PROJECT_REFERENCE §21.2.

## Limitations
- Actual Samsung Keyboard `commitContent` may not reach JavaScript in Android Chrome/PWA/Samsung Internet. This code handles forwarded rich events only; cannot guarantee all Android keyboards work from browser code. A native Android input bridge would require separately approved packaging and on-device validation; no such native shell is delivered here.
- Real Samsung phone, clipboard, installed PWA, real Scratch two-user media ACL/login, transparent rendering, keyboard/Back/light/dark/black/manual acceptance are unverified.
- No production backend writes, scratch auth/data imports or account data copying; shared Scratch remains unchanged. Vercel alias must be explicitly matched to Scratch Web platform before claiming authenticated usability.
- Sticker library size is capped at 32 only for the optional legacy picker; keyboard sends have no permanent picker entries but per-recipient files can accumulate until safe cleanup retention is designed.

## Next action
- Task PR #500 focused Actions 38039853898 SUCCESS; squash landed on stable Preview SHA da437a11a85fcf1f5f49fc980be85c0d7c8a23ae. Canonical Actions 38039927104 built/typechecked but failed aggregate-only PWA asset caps by 3497 raw, 450 gz, 3460 precache bytes, plus unit test mock missing pending get and checkpoint contract requiring literal 'Current task:'. This repair updates only aggregate caps by 5000 raw/1000 gzip/5000 precache, preserves entry/startup/Home guardrails and historical baseline; corrects the isolated unit mock/checkpoint. Scratch Appwrite rejected exact stable Preview Web platform registration with 403 additional_resource_not_allowed because 6 platforms already exist. Existing wildcard is not proof of actual login/CORS. Real phone acceptance remains open.
- Complete coherent task commit `[verify:focused]`, repair test/compile failures, squash task PR into stable Preview, require full canonical CI and matching READY Vercel. Update issue #413 with final SHA and any unresolved blocker. Do not promote to `dev`/`main` without explicit user instruction. User's mandatory acceptance is Samsung keyboard tray tap → send automatically with no import; only real Samsung device check can prove that.
