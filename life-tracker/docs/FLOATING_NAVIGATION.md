# Floating navigation and immersive display (#2593)

## Contracts
- Classic remains the default. `floatingBottomNavigation` is an ordinary validated owner settings row; only Boolean true opts in. Existing tab semantics, badges, accent placement, and upward tab shortcuts remain shared.
- Floating uses a fixed safe-area-aware pill with downward drag and an accessible in-app restoration target. Dismissal belongs to the current owner/session, not sync. Chat detail temporarily suppresses navigation without changing dismissal intent. A keyboard viewport reduction on touch devices temporarily conceals the dock without changing that intent.
- The fixed navigation box reserves settled clearance. The animated inner dock follows the pointer without changing React state or the measured navigation box each frame; Calendar rebinds its observer when the lazily loaded dock replaces Classic. Route swipes consume the same clearance. Existing scroll ownership and modal layers remain intact.
- The edge-to-edge preference is device-local and owner-scoped. It opts into dynamic viewport sizing and best-effort theme-matched browser chrome; the app already uses viewport-fit=cover. It cannot guarantee native Android system bar transparency or change OS gesture/three-button controls. It does not change PWA manifest identity.
- The explicit immersive control uses only browser-supported Fullscreen API on direct user activation and derives active state from fullscreenchange. A rejected or unsupported operation leaves normal layout available. Browser and native system controls determine the actual fullscreen result.
- No Appwrite schema, Function, infrastructure, or Production changes are part of this feature.

## v0.153.1 visual refinement
- The visible pill has no resting drag grip and uses a compact single-row layout. Swipe down anywhere on the open dock to dismiss; the visually hidden, named Hide navigation control remains keyboard/screen-reader reachable and reveals its focus indication when keyboard focused.
- The in-app restore handle remains tappable/swipeable, with a smaller, quieter indicator when the dock is hidden.
- Only wallpaper-backed Soft Frosted Glass mode applies the lighter, wallpaper-visible dock surface; the existing theme-aware glass tint and 0–100% transparency preference remain authoritative. Classic navigation and wallpaper-off surfaces retain their prior materials. Forced colors, reduced transparency and high contrast continue to use an opaque fallback.

## Acceptance
The canonical issue has the complete batched Android/Brave PWA, desktop, gesture, keyboard, scroll, theme, and fallback checklist. Physical system-bar appearance and native immersive behavior are separate manual evidence; an emulated browser or CSS safe area cannot prove them. The official stable Preview must pass exact canonical CI and deployment verification before handoff.
