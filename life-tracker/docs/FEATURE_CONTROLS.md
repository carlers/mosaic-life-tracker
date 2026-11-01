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
| TodoMate import | `mosaic_disable_todomate_import` | New TodoMate transfer previews and import starts, while preserving existing data and an import already applying |
| Timeline mode | `mosaic_disable_timeline_mode` | Hide Timeline controls and fall back to Categories in Day View; retain saved mode and sort settings |
| Holiday indicators | `mosaic_disable_holiday_indicators` | Hide fetched holidays in Calendar and Day View without changing the user's country/visibility preference |
| Calendar pinch gestures | `mosaic_disable_calendar_pinch_zoom` | Disable Calendar pinch interaction; retain current zoom preference and explicit layout choices |
| Profile photo uploads | `mosaic_disable_profile_photo_upload` | Block new profile photo uploads while preserving existing photo and Remove action |
| Profile sharing | `mosaic_disable_profile_sharing` | Hide Profile's Share action and prevent initiating new share |
| Friend discovery | `mosaic_disable_friend_discovery` | Hide Explore search and block new lookup requests; leave friends, requests and messaging alone |
| Sticker-pack discovery | `mosaic_disable_sticker_pack_discovery` | Hide pack Discover and install/remove controls; keep installed packs, sends and GIPHY available |
| Keyboard shortcuts | `mosaic_disable_keyboard_shortcuts` | Disable Mosaic single-key shortcuts while preserving the user preference and ordinary accessible navigation |
| Calendar task previews | `mosaic_disable_calendar_task_previews` | Hide per-day task previews in Calendar while preserving counts, task data and date navigation |
| Task timestamp display | `mosaic_disable_task_timestamps` | Hide created/completed time metadata in Day View while retaining timestamps and display preferences |
| Diary panel in Day View | `mosaic_disable_day_view_diary_panel` | Hide the optional embedded Diary panel while retaining the Diary, entries and original layout settings |
| Bucket List creation | `mosaic_disable_bucket_list_creation` | Prevent new aspirations while retaining existing goals, edits, linked tasks and sync |
| New friend requests | `mosaic_disable_friend_requests` | Hide Add on search results and reject initiating new requests; retain queued previous requests and all response/removal/blocking actions |
| Push enrollment | `mosaic_disable_push_enrollment` | Block new device opt-in and browser permission prompts; retain existing subscriptions, opt-out, preferences and in-app Alerts |

Keep flags **inactive** unless a feature is intentionally disabled. These are
global operator controls, not per-account targeting or permission checks.
Before a flag is used, confirm its PostHog project and rollout target. A
confirmed remote switch changes existing online clients on their next refresh:
the adapter refreshes every five minutes and on reconnection. Initial flag
evaluation is nonblocking and existing values are retained across same-identity
refresh failures; an offline cold start has no authoritative remote snapshot and
uses the locally enabled default. Therefore, this is **not** a security or
instant revocation mechanism.

**TodoMate import contract:** Disabling this switch hides the Settings entry and prevents new transfer previews or new import starts. A transfer already applying must be allowed to finish to avoid a partial migration. No local imported rows, resumable import markers, or offline sync work are deleted by the switch.

**Batch P1 preservation contract:** Operator controls override **presentation or initiation** only.
Timeline's existing preferences are not overwritten; on re-enable, the stored layout
restores. Holiday and Calendar user preferences are retained. Profile photo removal
remains available when new uploads are blocked. Friend discovery does not disable
existing contacts, requests, account blocking, messages, or their sync. Sticker-pack
discovery hides the catalog/install actions without deleting installed pack IDs or
preventing existing stickers from being sent. These controls are not privacy,
authorization, or data-retention enforcement.

**Low-risk display controls:** Disabling Keyboard shortcuts never disables Tab, Arrow, Enter, Space or ordinary navigation; it only overrides the Mosaic single-key command provider. Calendar task previews may display a task count but no task titles when disabled; tap the day to access its tasks. Timestamp labels and the optional Day View Diary panel are hidden without changing task/diary data or existing saved preferences. These four controls are distinct from users' own presentation settings.

**Initiation-only controls:** Bucket List creation may be paused without hiding goals or stopping replication of pending local writes. A disabled friend-request initiation gate blocks new requests before adding offline intent; already queued requests may still flush, and existing relationships, accept/cancel/block and discovery remain operational. Push enrollment must be blocked before `Notification.requestPermission()` or service-worker subscription; existing devices continue to receive and may unsubscribe, and reconciliation and settings remain available. These are **not** global social/push kill switches or server authorization.

**Data-preservation contract:** Never erase task/diary photos when uploads are
disabled. Existing images can still be viewed/removed; already queued offline
task photo uploads remain eligible for replay. Profile photos are unaffected.
Previously sent GIPHY stickers remain displayable. Disabling search never
removes tasks, settings, or messages.

**Implementation boundary:** Add each new optional feature to the typed
`FEATURE_DISABLE_FLAGS` registry in `src/lib/featureControls.ts`. Runtime
calls pass the corresponding **exact PostHog flag string** to
`useFeatureEnabled('mosaic_disable_...')` for rendering and
`isFeatureEnabled('mosaic_disable_...')` at command/network boundaries.
Both functions accept only registry-defined flag values at compile time; use
the value from the registry, not its camelCase property name. The registry
object itself is developer/test-facing and intentionally not a runtime import,
so new optional controls do not bloat the Home critical dependency closure.
Never call React hooks conditionally.
Remote controls are not authorization, backend capability detection, account
erasure, or a substitute for GitHub CI and Preview acceptance on code changes.
