# #2298 — Day View panel compositor A/B diagnostic

## Objective and scope
Owner observed severe drag stutter in a desktop Day View side panel but a comparatively smooth bottom sheet. Earlier synthetic panel/sheet React/layout timings failed to reproduce this difference, and owner-supplied rAF/DOM transform observations cannot prove composited frame presentation. This controlled frontend-only experiment isolates the panel's backdrop-filter layers and its persistent 3D-transformed inner wrapper. Neither is asserted to be the root cause.

## Implementation
Branch chatgpt/2298-panel-compositor-ab-20261126 is based on stable feature Preview 92fcadb4789c3577b1e4c89c1ac7b44562a478be (v0.152.3). A static no-private-data script returns immediately unless URL query mosaic2298Compositor=1 is present. Enabled, a small accessible HUD switches panel-only CSS between Default, No panel blur, No panel wrapper transform and Both disabled. Never modify task/diary overlays or underlying data. No analytics, clipboard, network, storage, Appwrite, account lookup or private DOM reads; no changes in ordinary application mode. Transform-off disables panel entrance animation while active, so compare held drags **after** opening.

## Verification and review
Test HTML + Playwright regression assert default inactivity and correct scoped computed CSS in each of four modes. Run exact branch full CI including browser, build and size; verify only official Preview branch source/READY, Preview Appwrite environment and immutable Preview URL before manual handoff. Do not promote the experiment to stable feature, dev, main or Production.

## Consolidated manual diagnostic (one batch)
On the same desktop/Brave tab, date, task density and wallpaper, open Day View side panel, move one task, one category pill and one Diary note slowly and rapidly for 2–3 seconds each under all four HUD modes. Note whether cursor overlay, insertion gap or full panel stutters; compare with normal bottom sheet in Default only. If blur-off consistently resolves stutter, investigate backdrop compositing; if transform-off consistently resolves it, investigate retained 3D layer; if neither, pursue actual display-composition trace instead of another speculative product fix. Real-device acceptance is not inferred from CI.
