# Session checkpoint

Updated: 2026-10-10
Current task: Issue #489 — repair persisted quoted sticker token and iOS reply focus (Preview v0.16.5).
Baseline: `feature/sticker-libraries` SHA `400ca9d1448617e6a88e8f23b5f2cb324351cadf` (v0.16.4), exact [full Quality Gate #38075888660](https://github.com/carlers/mosaic-life-tracker/actions/runs/38075888660) SUCCESS and keyed Vercel `dpl_F9Phx9cfy4GmfLQgeotB8XpaXh1r` READY. User confirms composer reply sticker thumb works, but **sent** reply shows text.
Task branch: `chatgpt/sticker-reply-snapshot-ios-489`. No promotion to dev/main authorized.

## Root cause and scoped fix
- Real outgoing send path: `src/lib/messageComposer.ts` `truncateForSnapshot` normalized whitespace and removed the essential `[Sticker: …]\\n[gp1:…]` / `[mp1:…]` newline. The prior component test constructed outgoing `replyToContent` by hand, bypassing the real builder. The server currently accepts snapshot strings up to 300 chars; validated sticker references fit without any backend change. Preserve exact canonical sticker wires while continuing the 100-char text snapshot behavior for nonsticker content.
- For existing persisted one-space-flattened quotes, `canonicalReplyStickerContent` reconstructs only an exact fully validated token for display; never interpret partial IDs, malicious URLs or ordinary prose as images. `ReplyPreview` uses it only for quote rendering. Add reply fields to `MessageBubble` memo comparator so a sync-changed quote is visible.
- iOS WebKit normally requires synchronous focus within a user activation to open the software keyboard. Focus the existing composer during the `onSwipeReply` pointerup handler, before setting reply state. Preserve prior BottomSheet exit/focus-trap flow for action-sheet Reply rather than breaking overlays; due to iOS gesture restrictions, opening its keyboard after the animated exit is **not guaranteed** and must be tested on a physical iPhone.
- No new dependencies, cache, media upload, sync schema, Appwrite Function, GIPHY key or artwork rights changes. Candidate version `0.16.5`.

## Verification
- Add unit coverage for builder snapshot preservation and strict legacy recovery, actual `useMessages` outgoing send persistence, and DOM sent-bubble quote recovery/memo updating; existing plain-chat no-autofocus remains protected.
- Focused task CI, stable squash merge, exact-SHA canonical full CI and keyed Vercel READY are acceptance gates. Android/iOS real device and Scratch two-account sync remain separate manual gates.

## Next action
- Finish tests, run focused verification, repair failures, squash task PR into stable Preview, and verify exact-SHA full CI plus Vercel READY. Update issue #489 with evidence and iOS limitations, no post-green status-only commit; do not promote dev or main without approval.
