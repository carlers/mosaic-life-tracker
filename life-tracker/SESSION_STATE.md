# SESSION STATE

Updated: 2026-09-17T00:00:00Z
ActivePlan: Phase 1 audits — final sweep
CurrentBatch: 6 of 9
CurrentTask: 1.6 Item 13 — accessibility (sub-batch 1: primitives layer)
Status: in_progress
NextAction: Run `npm run apply`, then continue to 1.7.a (message surfaces accessibility).
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
  - [ ] 1.7.a Item 13 — accessibility (sub-batch 2: message surfaces)
  - [ ] 1.7.b Item 13 — accessibility (sub-batch 3: task/calendar surfaces)
  - [ ] 1.7.c Item 13 — accessibility (sub-batch 4: layout/nav/settings surfaces)
- [ ] Phase 2 — refactor audit → refactor
- [ ] Phase 3 — optimize audit → optimize (bundle 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap)
- [ ] Phase 4 — spec audit group (meta-audit of AGENTS.md, discovery, enforcement; receives full WCAG AA audit)
- [ ] Feature work — Phase 3.5 Todo List, 3.6 Diary, 3.7 Notifications, API integrations (paused)
OpenQuestions:
- H1 — offline auth gate (OFF-1). §1 claims "100% offline functionality"; §23.6 maps network error → `user: null` → retry screen. Product/architecture decision required before Chat 2 can fix OFF-1. Options: (a) hydrate user from cached identity on network failure; (b) rename retry screen to an offline-mode screen with local read-only access; (c) accept behavior and downgrade §1's claim in docs.
Findings:
- CHORE-G-1 through CHORE-G-5 — resolved.
- OFF-1 Critical — Offline cold launch blocks access to local data. Blocked on H1.
- OFF-2 through OFF-13 — resolved (see prior state).
- RT-1 through RT-4 — resolved 1.2.
- ERR-1 through ERR-4 — resolved 1.3.
- STO-1 — resolved 1.4.
- PWA-1 through PWA-6 — resolved 1.5.
- A11Y-1 High [resolved 1.6] — `BottomSheet` had no `role="dialog"`, `aria-modal`, or `aria-labelledby`. Added all three; `titleId` is derived from `useId()` and bound to the optional `title`. Backdrop marked `aria-hidden="true"`.
- A11Y-2 High [resolved 1.6] — `BottomSheet` had no focus trap and no focus restore. Added `useFocusTrap` (new hook, ~90 lines, no new dependency): focuses the first focusable descendant on activation, wraps Tab/Shift+Tab within the sheet, restores focus to the previously-focused element on close. Skips `disabled` and `aria-hidden="true"` elements so a nested locked sheet does not steal focus.
- A11Y-3 Medium [resolved 1.6] — the drag handle is a pointer-only affordance and remains so; but its visual indicator (the small grey bar) is now `aria-hidden="true"` and the sheet's dismiss path via Escape is documented as the keyboard equivalent. No `role` added to the handle itself, because the handle is not a control — it is a drag target with a keyboard-reachable alternative (Escape).
- A11Y-5 Medium [resolved 1.6] — `Button` had `focus:outline-none` with no replacement. Added `focus-visible:ring-2 focus-visible:ring-emerald-500/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#111111]` to `baseStyles`. Applies to every variant.
- A11Y-6 Medium [resolved 1.6 — documented] — `variant="icon"` buttons are unnamed by convention. Documented as a per-callsite obligation in the variant's comment with a pointer to §14; callsite audit happens in 1.7.a–c. No primitive change: an accessible name cannot be synthesized from an icon child.
- A11Y-7 High [resolved 1.6] — `Input` and `Textarea` rendered their `<label>` as a sibling, not associated. Both now use `useId()` and bind `htmlFor`/`id`, respecting a caller-supplied `id` prop when present.
- A11Y-8 Low [resolved 1.6] — `Input` and `Textarea` had `focus:outline-none` with only a weak border-color signal. Added the same `focus-visible` ring as `Button`.
- A11Y-9 High [resolved 1.6] — `BottomNav` tab buttons had no `aria-label` and no selected-state indication. Added `aria-label={tab.label}` (or the unread-augmented label) and `aria-current={isActive ? 'page' : undefined}`.
- A11Y-10 Medium [resolved 1.6] — the unread badge was a bare `<div>` with a number, and the visible `<span>` tab label was reachable text. Both are now `aria-hidden="true"`; the badge count is folded into the button's `aria-label` (`"Chat, 3 unread"`).
- A11Y-11 Low [resolved 1.6] — `<nav>` had no label. Added `aria-label="Main"`.
- A11Y-12 High [deferred to 1.7.a] — `MessageBubble` gesture surface has no keyboard equivalent. Scope noted in this batch's plan.
- A11Y-13 Medium [deferred to 1.7.a] — no `aria-live` region for message status transitions.
- A11Y-15 through A11Y-17 [deferred to 1.7.a] — `MessageComposer` textarea label, character-count `aria-describedby`.
- A11Y-18 through A11Y-20 [deferred to 1.7.b] — `TaskItem` title/toggle/memo/image controls are pointer-only `<div>`s.
- A11Y-21 through A11Y-23 [deferred to 1.7.b] — `CategorySection` pill and inline add button.
- A11Y-4 Low [non-finding] — the backdrop's `onClick` is not keyboard-reachable; correct for a modal backdrop. No change.
- A11Y-14 Low [non-finding] — `data-message-id` is correctly exposed. No change.
- Non-findings (verified correct): OFF-5, E2, E3, F4, F5, F6, G1, G2, G3, H1, H2, H3, I1–I7.
Decisions:
- [2026-09-16] Chat 1 may emit docs-only mega files directly. → chore-c.
- [2026-09-16] §25.6 example block uses 3 backticks; should be 4. [resolved 2026-09-17 in chore-f]
- [2026-09-16] OFF-7 routed to batch 1.4. → Deferred.
- [2026-09-16] SESSION_STATE.md is the phase's single document. → chore-d.
- [2026-09-16] Permanent-failure UX for OFF-8/9: revert local RxDB patch via `FriendsProvider`. → 1.1.fix.
- [2026-09-16] OFF-10 offline UX: enqueue + throw `OfflineError`. → 1.1.fix.
- [2026-09-16] OFF-3 image-queue deferral: only error-message fix ships. → Deferred.
- [2026-09-17] Chat 2 must append post-batch instructions (§25.8). → chore-e.
- [2026-09-17] §25.9 reasoning discipline added. → chore-e.
- [2026-09-17] `npm run apply*` copies output to clipboard on exit. → chore-e.
- [2026-09-17] OQ1–OQ6 from chore-f. → chore-f.
- [2026-09-17] §0 dedup follow-up. → chore-f.
- [2026-09-17] CHORE-G rationale (five items). → chore-g.
- [2026-09-17] OFF-11 through OFF-13, OFF-2, OFF-4 fixes. → 1.1.fix.b.
- [2026-09-17] Batch 1.2 scope: Option A (realtime over all six tables). → 1.2.
- [2026-09-17] Realtime policy mirrors sync pull loop. → 1.2.
- [2026-09-17] Realtime lifecycle owned by `AppLayout`. → 1.2.
- [2026-09-17] Batch 1.3 scope: Option 3 (top-level + per-route boundaries). → 1.3.
- [2026-09-17] Batch 1.4 scope: `imageCache.ts` becomes single cache owner; OFF-6 documented only. → 1.4.
- [2026-09-17] Batch 1.5 scope: Option 2 (audit + fix); PWA-1 through PWA-6 fixes; SW is app-shell-only. → 1.5.
- [2026-09-17] Batch 1.6 scope: Q1=1 (interactive semantics only), Q2=a (`<motion.div>` → `<motion.button>` where applicable), Q3=split by domain. This batch is sub-batch 1 (primitives + BottomSheet + BottomNav). Sub-batches 1.7.a–c added to BatchPlan within Phase 1; the phase closes after 1.7.c. → 1.6.
- [2026-09-17] Focus trap: local `useFocusTrap` hook, no new dependency. One call site does not justify `focus-trap-react`. The trap filters `disabled` and `aria-hidden="true"` elements so a nested locked sheet's children do not receive focus. → 1.6.
- [2026-09-17] `Button variant="icon"` `aria-label` obligation documented in the variant comment; no runtime dev warning (would be a new behavior, not an existing pattern; deferred unless it recurs as a bug class). → 1.6.
- [2026-09-17] `MessageBubble` keyboard parity (A11Y-12): `Enter` opens the action sheet, which contains Reply and the emoji row — preserving feature parity with swipe-reply and double-tap-react without inventing new UI. Implemented in 1.7.a, not this batch. → 1.6 (decision), 1.7.a (implementation).
Deferred:
- OFF-1 → blocked on H1 decision.
- OFF-3 local-image-queue half → separate batch.
- Realtime channel-level reconnection backoff → future batch.
- OFF-6 LRU cap with byte budget → Phase 3 (optimize).
- PWA update-prompt UI, `beforeinstallprompt` affordance → Phase 3.5+ feature work.
- Full WCAG AA audit (contrast, reduced-motion, landmarks, skip link, form-field associations beyond Input) → Phase 4 meta-audit.
- A11Y-12 through A11Y-23 → 1.7.a–c within this phase.
LastApply: 2026-09-17 — fix: PWA / service worker audit — app-shell-only SW, SPA navigation fallback, no mid-session swap
LastAuditSummary: Batch 1.6 (sub-batch 1 of 4) shipped — primitives layer accessibility: `BottomSheet` role/aria-modal/aria-labelledby + focus trap + focus restore; `Button` and `Input`/`Textarea` focus-visible rings; `Input`/`Textarea` label association via `useId`; `BottomNav` aria-label, aria-current, unread-in-label, `aria-hidden` on decorative elements. New `useFocusTrap` hook (no new dependency). Sub-batches 1.7.a–c queued.
