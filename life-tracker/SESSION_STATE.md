# Session state

Updated: 2026-09-24
Current task: Home content regression + route swipe visual deck + Settings back swipe
Status: in progress.

## Active user prompt

> issues: 
> -home page doesnt even show anything under the friend carousel anymore. 
> - u cant even see the other pages while dragging the screen, it has to be smooth
> - u should be able to swipe right to go from settings back to me page
> - swiping on me page works on laptop but not on phone (it only works when u swipe under the logout button)
>
> now when u implement these fixes make sure it's still optimized and lag free, especially on mount.

## Progress

1. **Done — recover Preview baseline and current contracts.** Preview is `4258abd30a356be398901dec7cf13dc74c5eaccc`. Read current agent/session/roadmap/product/test workflow plus route-shell, Home, Me, Settings, and swipe implementation.
2. **Done — root-cause pass.** Home lost a definite-height ancestor when the route swipe wrapper changed from `h-full` to `min-h-full`, so Home's absolutely-sized friend swiper can collapse below the friend carousel. Non-Home primary pages still own nested vertical scrollers, which keeps phone touch handling inside child scroll containers and contradicts whole-page gesture ownership. Current swipe code only translates the active page over an empty background, so no destination page can be visible during drag.
3. **Done — update contracts + red regression coverage.** Verify #247 (`35953985241`) captured the intended reds: Home route surface lacked the definite `h-full/min-h-0` chain, the directional preview never mounted, Me still owned a nested full-page vertical scroller, and Settings right→Me was not mapped.
4. **In progress — implement route swipe deck.** Added a compositor-only current/neighbor deck: per-move work is one rAF-batched CSS-variable write, React state changes only when the active drag direction changes, and a route-specific destination preview is attached to the exposed edge. Performance review tightened this further: the live preview is a lightweight noninteractive shell rather than another route tree; actual destination chunks are prefetched after first paint/idle and the real page mounts only after navigation. Focused Verify #249 caught one architecture lint issue because the preview component file also exported the preload helper; preload ownership is now split into a non-component module. Verify #251 then exposed the existing reset effect calling preview setState synchronously; route changes now key/remount the gesture surface by the exact pathname instead, eliminating that effect and correctly resetting Account↔Settings even though both share the Me tab. Horizontal clipping uses `overflow-x-clip` so the gesture wrapper does not become an accidental vertical scroll container, the preview paint/layout is contained with an explicit viewport-height preview frame, and primary-page entry fades were removed to avoid post-swipe/mount animation work. Because the live neighbor is now a shell, ConversationsProvider aggregation stays route-local instead of precomputing Chat conversations on Me/Alerts mount. Settings right→Me is mapped as history-back when possible, with a deep-link replace fallback.
5. **In progress — fix Home/page scroll ownership.** Restored a definite Home height chain through MainLayout + PrimaryRouteSwipeSurface. Removed nested full-page vertical scrollers from Explore, Chat list, Me, and Settings so MainLayout owns mobile vertical scrolling and the horizontal route recognizer receives the full page.
6. **Pending — focused/browser verification and performance review.** Verify held-finger adjacent-page visibility, mobile-sized lower-page Me swipe, Settings right→Me, Home body height/content visibility, no route-preview mount on initial render, and no new frame-loop React state.
7. **Pending — final acceptance + Preview rollout.** Run exact-commit `[verify:full]`, move Preview only after green, confirm Vercel READY, and record remaining physical-device checks.

Roadmap pointer: primary navigation interaction correction.
Blockers: None.
