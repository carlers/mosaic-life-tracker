# Session state

Updated: 2026-09-21
Current task: Automated browser acceptance for native Back, nested carousel gesture ownership, and horizontal keyboard navigation
Status: The repeatable interaction checks now have a Playwright browser contract. Chromium with Samsung/Android-style mobile settings verifies a three-layer bottom-sheet Back stack, focus restoration, independent calendar/friend swipe regions, horizontal arrow navigation with editable-field protection, and 320 CSS px reflow. The canonical repository verification gate is green. No visual styling changes were made.
Roadmap pointer: Phase 3.7 remains complete. Phase 4 accessibility remains open because screen-reader, rendered-contrast, touch-target, 200% zoom, and physical-device acceptance still require manual evidence. Calendar-grid semantics also remains a separate Phase 4 item.
Checkpoint: Calendar gesture isolation now uses Swiper's explicit no-swiping region rather than capture-phase pointer cancellation, so the parent friend Swiper yields while Embla retains its full pointer lifecycle. HomePage explicitly enables the matching no-swiping class. The BottomSheet browser contract covers three nested modal history layers and opener focus restoration. The interaction contract uses Chromium CDP touch events rather than mouse-only drags.
Next action: On the stable Preview in the normal Samsung browser/PWA, confirm hardware Back closes nested sheets top-first and confirm a real finger swipe on the calendar changes only the calendar. Then finish the remaining Phase 4 manual accessibility protocol.
Blockers: No automated-gate blockers. Physical Samsung/PWA and broader manual WCAG acceptance remain pending.

## Preview acceptance

- PREVIEW-1 — Vercel can build from `life-tracker/` using the canonical production build.
- PREVIEW-2 — Direct loads of Mosaic BrowserRouter routes resolve to `index.html` without rewriting emitted static assets.
- PREVIEW-3 — A dedicated `preview` branch carries only an exact verified commit selected for hosted review.
- PREVIEW-4 — The stable Vercel production hostname is the canonical phone-test origin and is registered once with Appwrite.
- PREVIEW-5 — Dynamic Vercel branch URLs are not assumed to have Appwrite access.
- PREVIEW-6 — No deployment secrets are committed; PostHog remains optional and no-op without config.

## Working set

- `src/components/ui/BottomSheet.tsx`
- `src/components/home/views/CalendarCarousel.tsx`
- `src/pages/HomePage.tsx`
- `src/hooks/useHorizontalArrowNavigation.ts`
- `tests/components/CalendarCarousel.test.tsx`
- `tests/e2e/bottom-sheet-history.tsx`
- `tests/e2e/bottom-sheet-history.spec.mjs`
- `tests/e2e/interaction-contract.html`
- `tests/e2e/interaction-contract.tsx`
- `tests/e2e/interaction-contract.spec.mjs`
- `.github/workflows/playwright.yml`
- `docs/ACCESSIBILITY_AUDIT.md`
- `SESSION_STATE.md`

## Verification

- Interaction Browser Contract run `35607368142`: success on implementation commit `08d526559698b3daf72b722892e55ae87ce22ad4`; 6/6 Playwright checks passed in Chromium with Samsung/Android-style mobile settings.
- The browser contract verifies three nested sheet Back traversals before route history, final-sheet focus restoration, calendar-only touch swiping, friend-carousel touch swiping outside the calendar, ArrowLeft/ArrowRight calendar navigation without stealing editable caret keys, and no horizontal page overflow at 320 CSS px.
- Canonical GitHub Verify run `35607725909`: success on commit `66b4373ce98bd61165469fdfc86c3013376a05ed`; project contracts passed, 66/66 Vitest files and 487/487 tests passed, TypeScript/Vite production build passed, service-worker policy passed, and build-size budget passed.
- Commit `66b4373c...` differs from the browser-tested implementation only by aligning the DOM regression assertion with the Swiper no-swiping architecture; production interaction code is unchanged from the green browser run.
- Physical Samsung hardware Back and installed-PWA behavior remain manual acceptance items; automated Chromium history/touch emulation does not claim to replace OS-level evidence.
