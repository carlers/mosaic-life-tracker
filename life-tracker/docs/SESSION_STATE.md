# Session checkpoint

Updated: 2026-09-26

## Objective

Repair chat geometry and conditional message following on desktop and mobile.
Task branch: `chatgpt/chat-scroll-intent`; target: `fix/chat-scroll-to-bottom-v2`.
No promotion to `dev` or production is authorized.

## Implementation

- Chat detail bypasses the transformed swipe panel, uses a definite-height layout,
  and owns one message scroller with a non-shrinking header and composer/FAB dock.
- `useChatViewport` sizes the layout to VisualViewport height/offset at normal zoom;
  dynamic viewport height is the fallback. Removed keyboard-inset/overlay clearance.
- Scroll intent resets per account/thread. Initial load and outgoing additions pin;
  incoming additions follow only while pinned. Resize work re-checks current intent.
- FAB uses an 8px tolerance and unread-below dot. Search saves/restores the visible
  message anchor; sends close search. Quote navigation suspends following.
- Browser fixture renders production ChatPage and MainLayout with deterministic domain
  hook substitutes. It does not exercise remote message delivery or phone keyboards.

## Evidence and remaining work

- Before production edits, Chromium reproduced the height-chain defect with 60 messages:
  the message list had no internal overflow (`scrollHeight === clientHeight`).
- All 34 browser contracts passed, including 10 chat cases. Desktop/mobile screenshots
  were inspected. All 235 DOM tests passed before a final short-conversation input guard;
  its added regression and the 23 focused chat/layout tests passed afterward.
- Production build, PWA policy, size budgets, changed-file lint, project contracts,
  test discovery, and whitespace checks passed.
- Remaining delivery: commit/push, exact-SHA canonical acceptance, squash PR to the
  target Preview branch, and verify its deployment. Resolve status from GitHub/Vercel;
  do not create a status-only commit after acceptance.
- Real iPhone Safari and Android Chrome keyboard/rotation checks remain pending and
  must be reported separately from automated Chromium evidence.

## Device acceptance protocol

On the resulting Preview, open a long chat without focusing the composer; verify latest
message and dock. Receive at bottom, scroll upward and receive, tap FAB, send while
scrolled up. Open/dismiss keyboard, reply, rotate, and repeat while reading history.
Confirm dock stays visible and incoming messages never interrupt history reading.
Record browser/device and deployed SHA; do not infer acceptance from desktop emulation.
