# Session checkpoint

Updated: 2026-09-26

Current task: chat bottom anchoring and mobile keyboard behavior on `fix/chat-scroll-to-bottom-v2`.

## Repository state

- `main`: production.
- `dev`: integration/staging.
- Stable Preview branches are direct children of `dev`, including `fix/*`, `feature/*`, `perf/*`, `security/*`, and `refactor/*`.
- AI task work uses `chatgpt/**` or `codex/**` branches and is squash-merged into the named stable Preview branch.
- Never merge an AI task directly to `dev` unless the user explicitly requests promotion.
- Vercel deploys configured stable Preview categories; AI task branches remain blocked.
- The repository is public. Quality Gate is push-driven only.

## Current implementation

Task branch: `chatgpt/chat-scroll-to-bottom-v2-clean`.

PR: #70 → `fix/chat-scroll-to-bottom-v2`.

Relevant files:
- `src/pages/ChatPage.tsx`
- `src/components/messages/useChatScroll.ts`
- `src/components/messages/MessageComposer.tsx`
- `src/components/messages/ScrollToBottomButton.tsx`
- `src/components/messages/useKeyboardInset.ts`
- `tests/react/useChatScroll.test.tsx`
- `tests/components/ChatScroll.test.tsx`
- `tests/components/KeyboardInset.test.tsx`
- `index.html`
- `vercel.json`

## Root causes

1. The old autoscroll performed one `scrollTop = scrollHeight` during the React layout phase. Variable-height message layout can continue after that point, so the viewport can stop short of the real bottom.
2. Bottom clearance was a fixed padding value while the composer was an independent overlay. Reply previews, the character counter, and keyboard movement could therefore cover the newest message.
3. The composer was anchored to the layout viewport. Mobile keyboards can shrink/offset the visual viewport without moving layout-viewport fixed/absolute elements.
4. The scroll FAB had an independent bottom anchor instead of being attached to the composer.

## Implementation

- Scroll to the latest message on chat mount and whenever the latest message ID changes.
- Re-run the scroll in the next animation frame.
- Observe both rendered message content and the scroll container with `ResizeObserver`, so late content layout and keyboard/composer clearance changes re-pin the bottom.
- Measure the composer with `ResizeObserver` and reserve its actual height in the message scroller.
- Keep composer and scroll FAB in one fixed bottom dock.
- Track `visualViewport.resize` and `visualViewport.scroll` with rAF; compute keyboard inset as layout viewport height minus visual viewport height and offset.
- Ignore visual-viewport keyboard math while pinch-zoomed.
- Keep safe-area padding in the composer.
- Add `interactive-widget=resizes-content` as an additional browser hint; VisualViewport remains the fallback for browsers that do not resize the layout viewport.
- Enable Vercel Preview for `fix/*`.

## Verification

Latest full Quality Gate run before the current repair:
- Build: passed.
- Dependency audit: passed.
- Browser contracts: passed.
- DOM shard 2: passed.
- DOM shard 1 initially failed only because the existing `useChatScroll` regression expected an impossible `scrollTop === scrollHeight`; browser scrollTop clamps to `scrollHeight - clientHeight`. The test was corrected to assert the actual browser contract.
- Keyboard inset tests passed.
- The current final SHA is `0dffe464cbc7fb64a13925c6614a5b9c2a427a2c` and includes `[verify:full]`; its canonical gate is still pending.

## Delivery

After exact-SHA canonical acceptance:
1. Squash-merge PR #70 into `fix/chat-scroll-to-bottom-v2`.
2. Wait for the fix-branch Vercel deployment to reach READY.
3. Verify the resulting Preview URL.
4. Perform the real-phone protocol: open an existing chat, confirm latest message is visible; send; receive; focus the composer; confirm composer and FAB sit above the keyboard; dismiss keyboard and confirm they return to the bottom.
5. Record manual/device evidence separately. Do not claim device acceptance without actually performing it.

No `dev` merge is authorized for this task.
