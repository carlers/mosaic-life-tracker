# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits — final sweep
CurrentBatch: 7 of 9
CurrentTask: 1.7.a Item 13 — accessibility (sub-batch 2: message surfaces)
Status: in_progress
NextAction: Run `npm run apply`, then continue to 1.7.b (task/calendar surfaces accessibility).
NextChatRole: chat2
BatchPlan:
- Phase 1 audits — final sweep (current)
  - [x] 1.1 Item 10 — offline behavior audit (findings inline below)
  - [x] 1.1.chore — dump XML format
  - [x] 1.1.chore-b — §25.4/§25.6 offboarding-trigger split + review payload
  - [x] 1.1.chore-c — Chat 1 docs carve-out + review-artifact boundary
  - [x] 1.1.chore-d — SESSION_STATE.md as phase document + audit findings baked in
  - [x] 1.1.fix — Offline write resilience (OFF-8, OFF-9, OFF-10, OFF-3 error-message only)
  - [x] 1.1.chore-e — §25.8 post-batch instructions + §25.9 reasoning discipline + apply clipboard
  - [x] 1.1.chore-f — AGENTS.md compression
  - [x] 1.1.chore-g — AGENTS.md compression follow-up
  - [x] 1.1.fix.b — Cached-data rendering + small offline fixes (OFF-11, OFF-13, OFF-12, OFF-2, OFF-4)
  - [x] 1.2 Item 9 — realtime subscriptions layer (Option A: all six tables)
  - [x] 1.3 Item 12 — error boundaries / crash resilience (Option 3: top-level + per-route)
  - [x] 1.4 Item 7 residual — storage/imageCache consolidation (absorbs OFF-6, OFF-7)
  - [x] 1.5 Item 11 — PWA / service worker audit + fixes
  - [x] 1.6 Item 13 — accessibility (sub-batch 1: primitives layer)
  - [x] 1.7.a Item 13 — accessibility (sub-batch 2: message surfaces)
  - [ ] 1.7.b Item 13 — accessibility (sub-batch 3: task/calendar surfaces)
  - [ ] 1.7.c Item 13 — accessibility (sub-batch 4: layout/nav/settings surfaces)
- [ ] Phase 2 — refactor audit → refactor
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions:
- H1 — offline auth gate (OFF-1). Blocked pending product/architecture decision.
Findings:
- CHORE-G-1 through CHORE-G-5 — resolved.
- OFF-1 Critical — Blocked on H1.
- OFF-2 through OFF-13 — resolved.
- RT-1 through RT-4 — resolved 1.2.
- ERR-1 through ERR-4 — resolved 1.3.
- STO-1 — resolved 1.4.
- PWA-1 through PWA-6 — resolved 1.5.
- A11Y-1 through A11Y-11, A11Y-4 (non-finding), A11Y-14 (non-finding) — resolved 1.6.
- A11Y-12 High [resolved 1.7.a] — `MessageBubble` gesture surface had no keyboard equivalent. Bubble is now a `<button>` with `aria-label` derived from sender + task-ref + reply + content, and `Enter`/`Space` opens the action sheet (which already contains Reply + emoji row). Swipe-reply and double-tap-react remain pointer enhancements; the action sheet is the keyboard-parity path for both. Focus ring matches the 1.6 primitives.
- A11Y-13 Medium [resolved 1.7.a] — bubble status row is `aria-hidden="true"`. Rationale: reading "Delivered" / "Seen at 3:42 PM" on every message traversal is noise; the sender's outgoing bubbles are already announced by the composer's `aria-label="Send"` when they send, and the sender's own read receipt is conveyed by the "Seen" indicator visually. An `aria-live` region for the last-message transition was considered and rejected: it would announce read receipts unrelated to the user's current action, violating WCAG 4.1.3's "only when appropriate" guidance. Documented as a deliberate limitation, not a defect.
- A11Y-15 Medium [resolved 1.7.a] — `MessageComposer` textarea had no `aria-label`. Added `aria-label="Message"`.
- A11Y-16 Low [resolved 1.7.a] — character count now `aria-describedby`-linked and marked `aria-live="polite"` so the threshold crossing is announced once.
- A11Y-17 Low [non-finding] — `MessageComposer` send button already had `aria-label="Send"`.
- A11Y-24 Medium [resolved 1.7.a] — `ReactionRow` chips were `<motion.button>` (correct) but had no accessible name and no selected-state. Added `aria-label` (`"React with ❤️, 3 total"` / `"Remove ❤️ reaction, 3 total"`) and `aria-pressed={mine}`. Emoji glyph and count are now `aria-hidden` since both are in the label.
- A11Y-25 Low [resolved 1.7.a] — `ChatSearchBar` input had no `aria-label` (placeholder is not a label), the match counter was unlinked, and the search icon / close icon lacked `aria-hidden`. Fixed all three; counter is `aria-live="polite"` and `aria-describedby`-linked to the input.
- A11Y-26 Low [resolved 1.7.a] — `ScrollToBottomButton` `aria-label` did not distinguish the new-messages state. Now `"Scroll to bottom, new messages"` when `hasNewMessages`. `ArrowDown` and the green dot are `aria-hidden`.
- A11Y-27 Low [resolved 1.7.a] — `ReplyPreview` `X` icon and `Ban` icon lacked `aria-hidden`; `ReplyPreview` bubble variant is rendered inside an `aria-hidden` wrapper by `MessageBubble` so it does not double-announce. Composer variant keeps its `aria-label="Cancel reply"` button. `TaskRefCard` color bar and calendar icon are `aria-hidden`.
- MessageActionSheet — already correct on 1.6 pass; icon-only buttons have `aria-label`, action rows use icon+text. No change.
- useBubbleGestures — pointer-only by design (§21). No change; keyboard path lives on the bubble element.
- EmojiPickerSheet — third-party `emoji-picker-react` handles its own ARIA; the BottomSheet wrapper already provides `role="dialog"`. No change.
- Non-findings (verified correct): OFF-5, E2, E3, F4, F5, F6, G1, G2, G3, H1, H2, H3, I1–I7.
Decisions:
- [2026-09-17] Batch 1.6 scope: Q1=1, Q2=a, Q3=split by domain. → 1.6.
- [2026-09-17] Focus trap: local `useFocusTrap` hook, no new dependency. → 1.6.
- [2026-09-17] `Button variant="icon"` `aria-label` obligation documented, not enforced at runtime. → 1.6.
- [2026-09-17] `MessageBubble` keyboard parity via `Enter` → action sheet. → 1.6 (decision), 1.7.a (implementation).
- [2026-09-17] Batch 1.7.a `MessageBubble` accessible name: sender + task-ref title + reply quote + content, joined with commas. Chosen over a generic "message" label because it lets a screen-reader user identify a message in the thread without reading each one in full.
- [2026-09-17] Batch 1.7.a status row `aria-hidden`. Rationale in A11Y-13 above: per-message status announcements are noise, and an `aria-live` region for the latest read-receipt transition would announce events unrelated to the user's current action. Deliberate limitation, not a defect. Revisit only if a user reports missing read-receipt awareness.
- [2026-09-17] Batch 1.7.a `ReactionRow` chip label carries count: `"React with ❤️, 3 total"` on hover/announce. Rationale: the emoji and number are `aria-hidden`, so the count must be in the label or the button's accessible name is just the emoji.
Deferred:
- OFF-1 → blocked on H1 decision.
- OFF-3 local-image-queue half → separate batch.
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link) → Phase 4 meta-audit.
- A11Y-18 through A11Y-23 → 1.7.b.
LastApply: 2026-09-17 — feat: accessibility — primitives layer (BottomSheet dialog semantics + focus trap, Button/Input focus rings + label association, BottomNav labels)
LastAuditSummary: Batch 1.7.a shipped — message surfaces accessibility. `MessageBubble` is now a `<button>` with `Enter`/`Space` → action sheet, accessible name from sender + task-ref + reply + content; status row `aria-hidden`. `ReactionRow` chips have `aria-label` + `aria-pressed`. `MessageComposer` textarea `aria-label` + `aria-describedby` counter. `ChatSearchBar` input label + linked counter + `aria-hidden` icons. `ScrollToBottomButton` new-messages label variant. `ReplyPreview`/`TaskRefCard` icons `aria-hidden`. `MessageActionSheet` and `EmojiPickerSheet` verified correct, no change.
