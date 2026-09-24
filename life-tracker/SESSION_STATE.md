# Session state

Updated: 2026-09-24
Current task: Home content regression + route swipe visual deck + Settings back swipe
Status: implementation complete; final acceptance gate pending.

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
4. **Done — implement route swipe deck.** The current page and a lightweight route-specific neighbor preview move together using compositor transforms. Per-move work is one rAF-batched CSS-variable write; React state changes only when the drag direction first locks or changes, never every frame. Destination chunks preload only after first paint/idle and the real destination page is not mounted during drag. Horizontal clipping avoids a second vertical scroll owner, preview paint/layout is contained, primary-page entry fades were removed, and Chat conversation aggregation remains route-local. Settings right→Me uses browser history when available with a deep-link replace fallback.
5. **Done — fix Home/page scroll ownership.** Restored the definite full-height chain through MainLayout + PrimaryRouteSwipeSurface so Home content below the friend carousel has usable height again. Removed nested full-page vertical scrollers from Explore, Chat list, Me, and Settings so MainLayout owns mobile vertical scrolling and the horizontal recognizer receives the whole page.
6. **Done — focused/browser verification and performance review.** Verify #253 (`35955113312`) passed focused verification (5 files / 11 tests) and all 26 Playwright browser contracts. Browser coverage includes held-drag neighbor visibility, phone-sized lower-page Me swipe, Settings right→Me, Home full-height gesture surface, 320px reflow, accessibility, and the pre-existing interaction contracts.
7. **In progress — final acceptance + Preview rollout.** Run this docs-only closure commit through exact-commit `[verify:full]`; after green, move `preview` to that exact SHA, require Preview CI green again, and confirm the matching Vercel deployment is READY.

Roadmap pointer: primary navigation interaction correction.
Blockers: None.


## Test evidence review

- `HOME-CONTENT-HEIGHT` — **added-red-green**. Verify #247 captured the missing definite-height route surface; DOM coverage now pins Home's `h-full/min-h-0` chain, with browser coverage exercising the Home route gesture surface.
- `ROUTE-DRAG-NEIGHBOR` — **added-red-green**. Verify #247 captured the absent directional neighbor; DOM and real-browser coverage now require the destination preview to remain unmounted before a gesture and become visibly attached while the finger is held.
- `ME-PHONE-FULL-PAGE-SWIPE` — **added-red-green**. Verify #247 captured Me's nested `overflow-y-auto`; DOM coverage removes that nested owner and the 360×740 browser contract swipes from the lower Me page into Settings.
- `SETTINGS-RIGHT-BACK` — **added-red-green**. Verify #247 captured the missing Settings mapping; unit/browser coverage now pins Settings right → Me.
- `ROUTE-GESTURE-PERFORMANCE` — **existing-direct + structural checks**. The frame-critical path uses rAF only for a single CSS-variable write, transform-only motion, one lightweight preview shell, no per-frame React state, no full destination route mount during drag, and idle/fallback-delayed chunk preloading. Focused lint/tests and browser contracts are green; subjective 120 Hz smoothness still requires physical-device acceptance.
- Manual-only acceptance remains for visual confirmation that Home content is restored on the hosted app and for physical-phone 120 Hz gesture feel across Home/Me/Settings. Automated browser contracts cannot establish subjective frame smoothness on the user's device.

No judgment of overall suite sufficiency is made here.
