# Operational feature controls (#1026)

Mosaic's first feature controls are **remote opt-out kill switches**. There is no
new on-device user preference or server permission associated with these flags.
The default is **available** when PostHog is absent, loading, or has no matching
flag. To temporarily disable a feature, **enable its named PostHog flag** at
100% rollout; to restore the feature, disable that PostHog flag. The PostHog
project/rollout determines which clients receive the change.

| Feature | PostHog flag | Disabled scope |
| --- | --- | --- |
| Settings search | `mosaic_disable_settings_search` | Settings search box and results |
| Task search | `mosaic_disable_task_search` | Home search control, shortcut, overlay, optional module warmup |
| Chat search | `mosaic_disable_chat_search` | Chat search control and active search state |
| Task photo uploads | `mosaic_disable_task_photo_upload` | New task photo selection and save |
| Diary photo uploads | `mosaic_disable_diary_photo_upload` | New diary photo selection and save |
| GIPHY search | `mosaic_disable_giphy_search` | GIPHY tab, search request and new GIPHY sends |

Keep flags **inactive** unless a feature is intentionally disabled. These are
global operator controls, not per-account targeting or permission checks.
Before a flag is used, confirm its PostHog project and rollout target. A
confirmed remote switch changes existing online clients on their next refresh:
the adapter refreshes every five minutes and on reconnection. Initial flag
evaluation is nonblocking and existing values are retained across same-identity
refresh failures; an offline cold start has no authoritative remote snapshot and
uses the locally enabled default. Therefore, this is **not** a security or
instant revocation mechanism.

**Data-preservation contract:** Never erase task/diary photos when uploads are
disabled. Existing images can still be viewed/removed; already queued offline
task photo uploads remain eligible for replay. Profile photos are unaffected.
Previously sent GIPHY stickers remain displayable. Disabling search never
removes tasks, settings, or messages.

**Implementation boundary:** Add each new optional feature to the typed
`FEATURE_DISABLE_FLAGS` registry in `src/lib/featureControls.ts`, use
`useFeatureEnabled` for rendering, and use `isFeatureEnabled` at any
command/network initiation boundary. Never call React hooks conditionally.
Remote controls are not authorization, backend capability detection, account
erasure, or a substitute for GitHub CI and Preview acceptance on code changes.
