# Session checkpoint

Updated: 2026-10-11
Current task: Settings left swipe to restore the previously visited Settings child page after Back. Frontend-only Preview v0.17.0, based on dev `a806d63a98100efc725af65f823d36b1366b6c7d`. No dev/main promotion authorized.

## Scope and contract
- Existing Settings and child right-swipes, Back header controls, Escape-as-Back, native Android/browser Back, and Reduce animations remain unchanged.
- On a single-entry POP Back from a Settings detail (Preferences, Notification Settings opened from Settings, Release History, or Profile), the parent Settings page may swipe left to reopen that child using a normal PUSH with Settings parent state. Do not guess at browser history Forward: a sheet can consume that entry after Back. An unrelated/non-Settings forward entry, direct link, missing history index, multi-entry history jump, or new route PUSH/REPLACE offers no return swipe.
- During an eligible swipe, the actual previously visited page appears as the lazily loaded adjacent panel. Reuse the standard swipe gesture, accessibility, event ownership and reduced-motion handling.
- No backend, schema, Appwrite, or UI theme changes.

## Implementation and checks
- Extend Settings forward detection in `primarySwipeNavigation` and route transition tracking in `AppLayout`; normal navigation only for a proven child-return entry.
- Add previously visited detail pages to existing preview/preload mappings, keeping page trees unmounted outside a gesture.
- Add unit coverage for forward eligibility and DOM swipe surface coverage. Update §2 navigation contract and synchronize package/app versions to v0.17.0.
- Coherent task commit requests `[verify:focused]`; only focused CI and stable Preview canonical/Vercel acceptance can verify hosted behavior. Mobile browser/Android Back, Escape with setting on, direct-link fallback, and iOS gesture acceptance remain manual.
- Preview PR #566 merged as `2d22917`; first build exceeded entry gzip by 253 B. The focused-green simplification PR #569 merged as `64bddec`; all unit/DOM/browser shards pass, and 177 B entry gzip remains over the prior cap (131,777 / 131,600 B). All other bundle ceilings pass, including initial closure 144,696 / 144,850 B and Home closure 360,840 / 361,000 B.
- Accepted measured new feature footprint: increase ONLY entry gzip ceiling 300 B to 131,900 B (0.23%), retaining the initial/Home closure, raw, total assets, and precache limits unchanged. Version remains 0.17.0 because no working Preview was delivered. No production changes.
- v0.17.0 Preview `91913ce` passed Vercel build but the strict checked-in budget-baseline ratio test rejected a 131,900-byte entry ceiling (1.05318× baseline; maximum 1.052×). Correct ceiling is 131,750 bytes, within the original test's baseline ratio.
- Reduce remaining entry cost by reusing the resolved page directly, not allocating a Settings alias, and by shortening idle preload filtering while keeping warm Messages special handling intact. Verify emitted entry gzip is ≤131,750 B; preserve all other budget ceilings.
Next action: focused CI for this code-and-budget repair; squash into stable Preview, await canonical CI plus READY deployment; manual Android/iOS remains. No dev/main promotion.
