# Mosaic Project Reference

This document preserves Mosaic's detailed product contracts, architectural
invariants, implementation rationale, and historical decisions. It is reference
material, not an instruction file. `../AGENTS.md` contains the shared active rules.

Sections 5 and 25 retain workflow background and history; do not infer current
branch or deployment policy from those historical descriptions. [Delivery](DELIVERY.md)
owns the current `main`/`dev`/stable-Preview promotion contract, and
[AI workflow](AI_WORKFLOW.md) owns agent execution.

## 0. Hard Rules

1. RxDB schemas: never `deleted` — use `isDeleted` (§12)
2. Ordinary synced deletes use `isDeleted: true` tombstones during the retention window; permanent row cleanup is performed by the synchronization-safe tombstone GC (§7, `docs/TOMBSTONE_RETENTION.md`). Explicit whole-account erasure is the sole hard-delete exception and follows §23.8.
3. Row IDs ≤36 chars, `[a-zA-Z0-9_]+`, no leading `_` (§6, §11)
4. Existing remote rows: `updateRow`; new rows: `createRow`; 404 fallback on `updateRow`: `createRow`, never `upsertRow` (§6)
5. Outgoing messages: `read_at` is server-owned; omit on push (§12)
6. Message IDs must start with `msg_` — server-enforced (§11)
7. Cross-user writes go through Appwrite Functions, never direct client writes (§6, §20)
8. 401 from `account.get()` = "not logged in"; network error = "couldn't check" — never conflate (§10, §23.6)

### 0.1 Contract sources and enforcement

Mosaic separates project truth by concern. `../AGENTS.md` owns active implementation rules;
this reference owns durable product/architecture contracts; `PLAN.md` holds durable
roadmap scope and recorded milestones, not live acceptance evidence; GitHub Issues,
PRs, Actions, deployments, and applicable backend rollout records establish current
status. `SESSION_STATE.md` is a dated handoff snapshot, not an independent source of
verified completion. Workflow, test, and telemetry documents own their named processes.
`docs/README.md` provides the contributor-facing contract index.

`npm run contracts:check` is the structural guard for this documentation surface. It
verifies that the authoritative entry-point files exist, that required cross-pointers remain
discoverable, and that local Markdown links in those files resolve. `npm run verify`
executes that guard before lint, tests, and the production build. This checker validates
reference integrity and discoverability; it does not claim to prove that prose is
semantically complete or that implementation behavior matches every contract.

## 1. The Vision
- An offline-first, local-first, self-hostable "Life Tracker" PWA
- **Phase 1:** A pixel-perfect, highly polished clone of "Todo Mate" (tasks, categories, social calendar, diary) to replace an ad-filled app
- **Phase 2:** Optional, modular integrations for fitness, media, and personal CRM
- **Phase 3 (extension beyond Todo Mate):** 1:1 messaging with friends, message reactions, and task reactions — a native social layer woven into the calendar
- **Core UX:** A unified, dark-mode calendar view that aggregates all life data, featuring 0ms load times (via RxDB), bottom-sheet interactions, and 100% offline functionality. Cloud is strictly for background sync

## 2. Product Reference: The "Todo Mate" Clone (Phase 1)

A dark-mode calendar clone of Todo Mate. Shipped: tasks, categories, month/week calendar, day sheet, person carousel, social calendar, 1:1 messaging, message + task reactions, Todo List, and the Alerts activity feed. Planned: Diary view. Messaging/reactions and Alerts are Mosaic additions, not in the reference app (see §20).

**ARCHITECTURAL RULE:** every Category and Diary document carries a `visibility` field (`public`, `followers`, `private`). Appwrite RLS is avoided by server-mediated reads (`get_friend_calendar`) and server-mediated cross-user writes (`message-action`). See §6 and §20.

**Diary timestamp schema contract:** local Diary rows require both `createdAt` and `updatedAt`. Their Appwrite row shape therefore includes both `created_at` and `updated_at` varchar(50) columns. `created_at` is optional/default-empty at the backend only so older deployments can add it without rewriting existing rows; every new Mosaic diary write sends it. When pulling a legacy row whose `created_at` is absent/empty, map local `createdAt` from Appwrite's stable `$createdAt` metadata (then stable update metadata as fallback), never from `new Date()`, so repeated pulls cannot manufacture conflicts.

**Behavioral specs for planned views (governs Phase 3.5–3.7):**
- **Todo List view:** compact, color-only calendar grid. Clicking/tapping a day always selects it; no task titles appear on the grid. The compact month renders only the natural week rows required by that month (normally five, six only when spillover requires it); do not force a sixth week onto shorter months. The active month grid is horizontally centered inside its viewport, and neighboring carousel slides must not visually bleed into it. Selection is shown by a white circle around the day numeral only, not by filling the whole day cell. Each day reserves a fixed four-circle 2×2 completion marker: only categories with at least one completed task contribute color, ordered by the category `order` used by Day View and capped to the first four categories. One contributing category fills all four circles; two categories fill the top pair then bottom pair; three or four categories distribute deterministically in category order. No completed-category color yields the neutral marker. The marker overlays the number of incomplete tasks, or a check mark when the day has tasks and all are complete. Horizontal swipes that begin on the compact calendar grid use the same direct-manipulation behavior as the Calendar view: the month follows the finger smoothly, then snaps to the adjacent month, and the outer friend/person carousel MUST NOT advance. A non-swipe tap must remain a tap; keyboard arrow keys move/select the adjacent day (left/right) or week (up/down) without stealing arrows from editable fields. The selected-day task area reuses Day View inline. Owner mode keeps category/task editing; friend mode uses the same Todo surface and date navigation but is read-only for task data while retaining task reactions and reply/message actions. The Todo surface owns one cohesive vertical page scroll from compact calendar through all selected-day categories/tasks; the inline Day View MUST NOT create its own nested vertical task scroller. Horizontal day swipes inside this inline task area belong to the Todo List and MUST NOT advance the outer friend/person carousel; crossing a month boundary updates the displayed Todo month. The Day View header uses two compact rows inside the horizontal day-swiper surface: the first row is navigation-only with Previous day, a centered visible date header, and Next day; the second row keeps the optional Today tag centered and the Select control right-aligned. This removes contextual controls from the date line while keeping Today and task selection sticky. A swipe beginning on non-control header space can navigate days, while vertical-dominant gestures hand off to the enclosing page scroller. The Todo surface and nested Day View swiper must stay width-bounded and horizontally centered so no page-level horizontal scrollbar appears.
- **Todo/Day View polish:** the Todo month grid is visually transparent, borderless, horizontally centered, and uses larger day numerals; it sits immediately above the selected-day Day View without extra bottom card padding or an external spacer before the Day View date header. Opening a category's add-task control places the new-task row immediately below that category pill and before existing tasks; task rows align the left edge of their completion checkbox with the left edge of the category pill; the pending row follows that same alignment and its checkbox/title/input geometry matches an editing task row (same checkbox top offset, title baseline, and 2px input underline); its title input uses the same text size as a normal/editing task title, while the input underline/border uses the category color, and the pill's plus icon is intentionally larger than the prior 14px treatment. In Light mode, the category add pill uses the same neutral gray surface as incomplete Calendar task blocks, with the plus icon on a white circular background. In task selection mode, completion circles keep their normal completed/incomplete appearance and completion-toggle behavior; selected tasks are indicated by the row background rather than repurposing the completion control. Settings → Preferences exposes synced task/calendar behavior switches. **Keep adding in same category** defaults off; when enabled, pressing Enter on a valid pending task submits it, clears the input, and leaves that same category add row open and focused for the next task. **Add new tasks to top** defaults off; when disabled, newly created tasks append to the bottom of their date/category group, and when enabled they appear at the top. **Show collapse button for categories** defaults off; when enabled, each category gets a local expand/collapse control that hides its pending/task rows while collapsed, and opening the add-task control expands it again. **Show Today tag under date header** defaults off and, when enabled, adds a compact Today marker centered in the secondary Day View header row only on the current date. Owner Day View task rows render memo text inline rather than a generic memo indicator. Single-tapping memo text opens the memo in read mode; tapping the memo again inside that sheet enters edit mode. Double-tapping inline memo text opens the memo directly in edit mode. Double-tapping a task title enters inline title editing; triple-tapping a task title opens the memo editor. When triple-tap is enabled, it takes priority over double/single tap; swipe/drag still outranks taps.
- **Day View task ordering:** owner tasks carry a non-negative integer `order`, scoped to their date/category group. Legacy/local or remote rows without an order read as `0`; the v2 task migration deliberately assigns existing tasks `order: 0`, and equal orders retain the previous newest-created-first display order so the schema rollout does not reshuffle existing lists. Day View must materialize RxDB `RxDocument` task results to plain task snapshots before applying projected category/order overrides; never object-spread a raw `RxDocument`, because schema fields are prototype-backed and would be lost. New-task placement follows the synced task-position preference: bottom placement appends after the current maximum order in the date/category group; top placement uses order `0` and the existing newest-created-first tie-break so repeated top additions remain deterministic without renumbering siblings. A completed same-category reorder normalizes that group to consecutive `0..n-1` values. A completed cross-category move updates the task's `categoryId` and normalizes both the source and destination groups with one shared update timestamp. Persistence revalidates the complete affected task set before writing; concurrent additions/removals/category changes fail closed instead of overwriting unseen state.
- **Day View task reorder interaction:** a task title is the invisible drag handle. Holding it stationary for 500 ms (with a small finger-movement tolerance) activates dnd-kit's pointer sensor on a plain draggable task; movement before activation cancels reordering and remains available to native vertical scrolling/day gestures. On desktop, a quick mouse drag that begins on the task title or inline memo must reach the Day View Swiper even though those surfaces are semantic buttons; a stationary 500 ms hold on the title still activates task reorder. Dedicated controls such as the completion checkbox, image button, edit input, and reaction controls remain control-owned rather than swipe-through surfaces. Sheet-mode task drag runtime exists only while Day View is open on the active day; closing the sheet or leaving that day unmounts the dnd provider and its drag registry so reopening always starts from live task data. During a drag, dnd-kit owns sensors, collision detection, auto-scroll, and one official `DragOverlay`, while React remains the sole owner of real task DOM and ordering. The real `TaskItem` is never registered as dnd-kit's draggable element: each row exposes an invisible geometry proxy as the draggable source while the visible task title remains the activation handle. The official `DragOverlay` is registered as dnd-kit's feedback element, so Feedback does not create a placeholder or move the real task row; the visible source task stays mounted under its original category inside a collapsed React-owned slot. Each visible task row exposes high-priority top/bottom droppable halves for before/after insertion. The category header row is the only lower-priority category-level target and means insert-at-start; this deliberately matches the first task's upper-half destination so crossing the pill/first-row boundary cannot oscillate between unrelated placements. Empty and collapsed categories remain droppable through that header. The last task's lower half remains the append path. Projection is recalculated from the immutable drag-start snapshot using only valid dnd-kit drop targets and is represented by a lightweight React-owned insertion gap. That gap is itself a droppable for its exact insertion index, so when the gap opens under the finger it remains a valid, semantically identical target instead of causing collision feedback. Momentary true no-target gaps keep the last valid visual projection stable, but releasing outside a valid target commits nothing; task reordering does not use `useSortable` or the `OptimisticSortingPlugin`. Release promotes the final placement to a committed optimistic state until live RxDB catches up; candidate placement must contain exactly the live task IDs once each, matching live/category integrity, and stale/invalid placement is ignored and retired outside render. A failed older persistence generation also invalidates any newer optimistic placement derived from it. Cancellation commits nothing. The floating overlay uses Mosaic's normal background rather than category fill. No custom pointer coordinator, manual pointer geometry, `elementFromPoint` hit testing, or third-party reparenting of a real task node is part of this contract.
- **Day View sheet interaction:** tapping the exposed backdrop closes a sheet. Phone full-height sheets leave a small backdrop strip so that dismissal target exists; tablet-and-larger full sheets may use the full dynamic viewport height. The entire exposed Day View sheet body is part of the horizontal day-swipe surface, including blank space below the final category/task; the native day Swiper must fill the sheet content height rather than ending at the last rendered category. Neighboring/inactive Day View slides must use the same category/header vertical geometry as the active slide, including empty categories; activation may add drag/drop behavior but must not change padding or category spacing as the swipe settles. The Day View date/navigation row is both part of that horizontal surface and an allowed vertical drag-to-close handle. Horizontal drags on the shared row are direct-manipulation Swiper gestures: the row visibly follows the finger before snapping. BottomSheet may claim the gesture only after movement is clearly vertical for drag-to-close; do not replace horizontal motion with a release-only sheet fallback. Unmodified ArrowLeft/ArrowRight mirror previous/next day unless focus is in an editable control. Opening a task photo from Day View uses the image's real intrinsic dimensions so PhotoSwipe preserves the source aspect ratio; portrait, square, and landscape images must never be forced into a fixed 16:9 frame or stretched horizontally/vertically. The photo viewer is a nested browser/Android Back layer above Day View: one Back press closes the viewer and clears its Day View state without closing Day View, while the next Back may dismiss Day View. PhotoSwipe's X and vertical-dismiss gesture consume that same viewer history layer so no stale modal entry or viewer state can resurrect on the next Day View open.
- **Home task search:** the Home top bar places Search immediately beside the hamburger. Opening Search expands/focuses a Home-owned search field and keeps the user on Home; results appear in an overlay below the bar without reflowing the calendar. Search covers only the signed-in user's tasks and runs entirely over the existing local live task/category arrays—no Appwrite request, per-keystroke RxDB query, duplicate always-on task/category subscription, image fetch, or thumbnail decode is allowed. Title matching is case-insensitive; prefix matches rank before substring matches. Filters support multiple categories plus Any date, Today, This week, This month, and a custom start/end range. With no query or active filter the panel shows guidance instead of rendering all tasks; filters alone may return results. Future/today results sort chronologically before past results, which sort newest-first, and the rendered result list is bounded. Each result shows title, category/color, date, completion state, and lightweight memo/image presence icons. Selecting a result opens the existing owner Day View sheet at that date and focuses/highlights that task. Search query, filters, result scroll position, and expanded state remain mounted under Day View so browser/Android Back or downward Day View dismissal returns to the same search state; explicitly closing Search clears its state. Search/filter controls opt out of the Home→Explore gesture. Expansion/result motion must be transform/opacity/layout based, reduced-motion aware, and must not introduce per-frame React state.
- **Alerts / friend-completion notifications:** the Alerts tab is a server-backed, account-scoped activity feed for completed friend tasks.

  **Retention and server policy**

  Unread task-completion receipts display for an account-synced configurable 1, 3, 7 (default), 14, or 30
  days after server arrival; after the server-authored first read, a separate configurable 1, 12, 24
  (default), 72, or 168-hour timer takes over without an additional unread cap. Valid read and unread
  timers are capped at 37 days from arrival for physical retention. Read timestamps are server-owned and
  never reset. The privileged Function resolves the authenticated recipient's two owner-scoped synced
  settings rows by their deterministic hashed Appwrite-safe IDs, validates allowlisted durations, and
  falls back to defaults if absent/invalid/deleted; it does not trust browser-provided policy values.
  Fetch, exact notification tap and mark-read all enforce the same server policy and current
  friendship/task visibility. The account-scoped offline cache keeps up to 100 still physically
  recoverable receipts so user preference extension can redisplay them without reviving a physically
  deleted receipt; the active feed filters them by the current synced policy. The existing hourly Function
  purges receipts older than 37 days using the `idx_notification_created` index (migration 005); task
  events older than seven days still cannot create retroactive receipts or recreate purged IDs.

  **Read timing and feed grouping**

  On active Alerts a row must be at least 60% visible in the focused foreground page for 1.5 seconds
  before becoming read; previews, background/obscured tabs, and offscreen rows do not mark read. "Mark
  loaded read" applies only to fetched rows. Activity groups use fixed local 30-minute completion-time
  windows (not scheduled task dates) and show each task's actual completion clock time.

  **Focused task navigation and access**

  Clicking a task preloads the lazy Friend Day View code on interaction and opens the existing
  `FriendDayViewSheet` over Alerts without remounting its BottomSheet history layer as data arrives. A
  server-owned `get_friend_task` action authorizes the accepted reciprocal friendship and live task
  completion/visibility and fetches only the tapped task and its public category metadata; this fast
  lookup runs before the larger `get_friend_calendar` request, which populates the rest of the sheet
  afterward. The chosen task opens on its current scheduled date and receives a focused scroll/highlight.
  A backend without the new action falls back to the old full calendar, while a forbidden/private/deleted
  task fails closed; a later full-calendar access revocation also hides the task. The date-navigation
  header sits outside native Swiper so vertical pulling on its title can drag the sheet down to dismiss,
  while arrow controls and horizontal day swiping remain separately owned. BottomSheet entrance/exit and
  drag use a unified Framer Motion `y` transform; the actual sheet must move under a held touch before
  release, not just close based on displacement after a static hold. The browser interaction contract
  measures the moving sheet during the gesture. Shared task overrides inside private categories use a
  neutral "Shared tasks" header rather than leaking private category metadata. Settings → Notifications
  (also linked from the Alerts gear) owns account-synced unread/read history-retention dropdowns alongside
  separate device-local push controls; push no longer lives under Preferences.

  **Eligibility and delivery deduplication**

  A task completion is eligible only when the task is currently non-deleted, effectively visible to
  friends (task visibility overrides category visibility), and the actor/recipient relationship is
  mutually accepted. TodoMate-imported completions and completion timestamps before the fixed Alerts
  launch cutoff are ignored so migration/history sync cannot generate an alert storm; post-launch
  completions remain eligible even when an offline device does not sync them for days. Each recipient
  event uses a deterministic recipient+task+completion ID so repeated Appwrite task create/update events
  are idempotent and do not resend push after the row already exists.

  **Feed authorization and offline caching**

  Feed reads revalidate the live friendship, current completed task state, completion timestamp, and
  effective visibility before returning the task title; stale/private/unfriended rows remain server-only
  and are not rendered. The browser keeps at most 100 cached feed items per account for offline display,
  never exposes another account's cached feed during an account switch, and primary-route swipe previews
  are cache-only: they must not refresh or mark alerts read before navigation completes. The active Alerts
  page refreshes when its window regains focus so a push click or app return catches up without a manual
  refresh. Reply and task-reaction actions reuse the existing social/message contracts and are disabled
  offline.

  **Web Push permissions and notification privacy**

  Web Push is optional and device-local (device setup and VAPID security are documented in
  `MOBILE_PUSH_SETUP.md`): Notification Settings exposes the permission-triggering toggle only after the
  backend reports push as configured, and the permission request itself must remain in the direct user
  gesture before any network wait. Unsupported/blocked/unconfigured devices still receive the in-app feed.
  iOS requires the installed Home Screen PWA for Web Push. Push lock-screen copy is generic by default. A
  separate, device-specific, explicitly enabled subscription setting `include_task_details` allows a
  recipient's friend display name and the currently shared task title to appear in a notification; the
  backend rechecks current completion/visibility before adding text, clamps names/titles, and never adds
  memos/photos. Previously delivered lock-screen text cannot be revoked. Push destinations are
  account-bound, same-origin links to an exact notification receipt. The service worker opens generic
  Alerts even when its local active-account marker is absent or mismatched, but never deep-links into
  another account's alert. Tapping an alert authorizes an exact server lookup independently of feed
  pagination, preserves a safe link through login, and opens the focused Friend Day View;
  expired/hidden/removed items fail closed. Different completions use different OS notification tags.

  **Device foreground notification behavior**

  The per-device `push-while-open` flag is stored in the same browser IndexedDB metadata store as the
  account marker and defaults to on, independent of account sync or push detail permissions. When
  disabled, supported Chromium browsers skip the system notification only while a same-origin Mosaic
  window is visibly foregrounded; when no window is visible, normal delivery continues. Other engines such
  as Safari/WebKit are not eligible for silent foreground Web Push, so the option is disabled in settings
  there and their push handler still calls `showNotification`. No remote schema or Function heartbeat is
  used for this preference; the durable Alerts feed remains unaffected. Notification Settings shows a
  server-update explanation when the optional rich-detail actions are unavailable, rather than falsely
  blaming connectivity.

  **Subscription account isolation**

  AuthProvider owns the service worker's active-account marker and clears it on logout/session loss; the
  service worker shows a push only when the payload account matches that marker, so a shared browser
  profile cannot surface another signed-in account's alert. Subscription register/unregister requests
  carry the initiating account ID and the Function rejects the write if the authenticated account changed
  while browser permission/subscription work was in flight. Existing browser subscriptions may be
  re-registered to the current account when online, but that reconciliation must never overwrite the
  active-account marker after an account switch.
- **Account/data controls:** sign-out actions remain in normal page flow rather than being pinned below a nested scroller. The Me page does not render a decorative quotation/author block. Its social stats label accepted relationships as **Friends** and read the count from the shared FriendsProvider; do not hard-code the count or add a second friendship subscription. Settings keeps **Delete Account** distinct from **Clear Local Data**. Delete Account requires the exact typed confirmation `DELETE` and enters the server-authoritative permanent-erasure protocol in §23.8; it removes the Appwrite login account as well as Mosaic-owned live data and cross-user copies/references. Clear Local Data only signs out and removes this browser's offline state. Settings also exposes the one-way **Import from TodoMate** migration. That importer is read-only toward TodoMate, sends credentials directly from the browser to TodoMate's Firebase/Google login path, persists no TodoMate credential/token, previews the migration before Mosaic writes, and imports only through the existing Merge-restore engine. See [TodoMate import](TODOMATE_IMPORT.md) for mapping, privacy, limitations, and live acceptance.
- **Bottom navigation inset:** the global content inset reserves only the fixed bottom-navigation height plus the device safe-area inset; it must not create an extra dark spacer above the nav or obscure the final page content.
- **Primary page swipe navigation:** the five bottom-nav pages form a direct-manipulation horizontal route sequence Home → Explore → Alerts → Chat → Me. A valid horizontal swipe visibly drags the current route surface with the finger before completing navigation, and the destination page is visibly attached on the exposed side throughout the held drag; never reveal an empty shell/background between pages. Vertical scrolling remains native and nested horizontal owners keep priority. On Home, route navigation to Explore may begin only from the top hamburger/menu layer so the person/calendar carousels keep their existing horizontal gestures. Home's route-shell ancestry must preserve a definite full-height chain so the absolutely-sized friend/person swiper below the pill carousel cannot collapse. On every other primary page, MainLayout owns the vertical page scroll and the swipe owner covers the entire scrollable page content down to the bottom-navigation inset; primary page implementations must not add a nested full-page `overflow-y-auto` scroller that steals phone gestures. On Me, a leftward swipe opens Settings and a rightward swipe returns to Chat. Settings participates as the Me detail edge: a rightward swipe returns through browser history to Me when Settings was opened from Me, with a direct/deep-link fallback that replaces to Me, and a leftward swipe does nothing. Settings child pages use the same direct-manipulation surface as parent-aware details: Profile and Preferences (`/settings/preferences`) right-swipe back to Settings with the Settings page visibly attached under the drag. Notification Settings (`/settings/notifications`) similarly right-swipes to its actual opener—Settings or Alerts based on a validated route-parent state—and falls back to Settings on a direct link; left swipes do nothing. The legacy `/settings/screen` path redirects to Preferences. Their header Back controls use the same parent-history/fallback rule. Individual chat routes stay outside the five-page sequence but use the same compositor-owned route-drag primitive for a rightward **left-edge** Back gesture to Messages. Friend Calendar (`/friends/:friendId`) is likewise a parent-aware Explore detail: opening it records Explore as the route parent, its header Back uses history with an Explore replace fallback, Explore stays selected in the bottom nav, and its route swipe is edge-only so the nested calendar carousel keeps horizontal ownership away from the reserved edge. The activation edge is measured from the live route-swipe surface, not the browser viewport, so Full screen, Comfortable, and Wide content-width modes share the same 32px edge contract. A true edge start has route-back priority even over a message bubble; outside that reserved edge, message-bubble swipe-to-reply remains the owner. Chat records/uses Messages as its route parent, reveals the already-warm Messages surface under the finger, and falls back to replacing `/messages` for direct/deep links. The fixed bottom nav remains stationary while page content drags. Destination route chunks on both reachable sides are prefetched after first paint/idle. Do not mount hidden neighbor route trees during the initial critical render. Once a horizontal gesture locks to a direction, mount only that already-prefetched directional route inside the attached neighbor panel so the user sees real adjacent-page content under the finger; the lightweight route-specific shell remains the Suspense fallback if the chunk is not ready. The opposite neighbor stays unmounted. Route drag transforms remain compositor-owned and custom per-frame DOM writes are rAF-batched without React state updates on every move. Commit uses either the existing distance threshold or an intentional short flick with sufficient release velocity; successful settles shorten for faster releases, while `prefers-reduced-motion: reduce` snaps without transform animation. Navigation-time async states keep their route chrome stable and use static content placeholders rather than centered spinners for Explore profile resolution, Messages conversation hydration, Chat thread hydration, and Friend Calendar loading; action-specific progress indicators such as search, refresh, import, and sync may still spin.
- **Appearance modes:** Settings → Preferences exposes System, Dark, Light, and Black appearance modes. System follows `prefers-color-scheme` live; Dark preserves Mosaic's existing charcoal palette; Black uses true-black primary surfaces for OLED; Light uses a light neutral surface/text palette while preserving semantic/category/accent colors. The selected mode is applied immediately, cached locally before React bootstrap to avoid a flash on reload, and persisted through the synced settings collection for the signed-in user. Theme changes are palette-only and must not alter layout, spacing, typography, gesture geometry, or task/category colors. Preferences also exposes a curated **Accent color** setting. Accent defaults to Mosaic emerald (`#10B981`), applies immediately through root CSS variables, caches per account for pre-React startup, and syncs through the existing settings collection. Accent controls interactive/brand emphasis such as primary actions, enabled switches, selection/highlight states, links, Today-style accents, unread/action badges, and focus rings. Semantic status colors remain independent: online/up-to-date/success stays green, warning/offline stays amber, destructive/error stays red, holidays/weekends keep their documented colors, and category/task colors are never rewritten by the accent preference.
- **Large-screen layout preferences:** Settings → Preferences also owns Content width and Bottom sheets preferences. Content width offers Full screen, Comfortable, and Wide; Comfortable keeps phones full width and, from the tablet breakpoint upward, centers the entire primary route-swipe surface at `min(70vw, 960px)`, while Wide centers it at `85vw`, so the live current/destination drag geometry stays unified. Bottom sheets offer Full width and Compact; Compact keeps phones full width and centers the shared BottomSheet primitive at up to 540px on tablets and larger. Both preferences apply immediately, are cached before React bootstrap to avoid a stretched-width flash, and persist through the existing synced settings collection.
- **Orientation:** Mosaic no longer globally forces portrait in the PWA manifest. Tablet/large-screen installed contexts may rotate between portrait and landscape; phone portrait locking is best-effort through the Screen Orientation API where supported, because the web manifest has no standard device-size-conditional orientation value.

- **Diary view:** per-day free-text entry, keyed by `yyyy-MM-dd`. Visibility field per entry. Renders in the same view-switcher slot as Calendar.
- **Alerts:** implemented friend-completion activity inbox; chat messages stay in Chat.
- **Calendar behavior preferences:** Settings → Preferences owns the synced calendar behavior toggles. **Start week on Sunday** defaults on to preserve the shipped Sunday-first layout; turning it off makes Month, Week, and Todo calendars Monday-first and updates week-range calculations consistently. Calendar and Todo date titles are always accessible **Go to today** controls. Tapping the Calendar title resets calendar focus to the current date; tapping the Todo month title resets Todo focus to the month containing today. Diary keeps its existing non-date title behavior. Preference switches use the shared Settings switch geometry: the thumb is explicitly left-anchored when off, translates only within the track when on, and must never overflow its track.
- **Holiday overlay:** Settings → Preferences owns a synced **Show holidays** toggle plus holiday country/region and holiday-type preferences. The overlay is viewer-local presentation, not a Task document and not friend-owned/shared data. Holiday data is fetched only when the feature is enabled, cached locally by country/year, rendered from cache offline, and refreshed in the background without gating Home, Calendar, Todo, Day View, or task editing. Calendar Month/Week renders holiday numerals and read-only holiday blocks in red before normal task blocks; Todo's compact grid keeps its title-free contract and uses only holiday numeral color, while its inline Day View renders the holiday label. Owner and friend Day Views render compact red holiday labels below the date header. In Light mode, Calendar holiday blocks and Day View holiday labels use a pale red surface with darker red text instead of the dark red treatment used by dark themes. Holiday occurrences never enter task completion, ordering, search, reactions, visibility, bulk actions, or sync. The provider boundary must stay replaceable for future calendar-source work; subdivision-only holidays are excluded until Mosaic exposes an explicit subdivision preference.
- **Calendar layout alignment (permanent):** Month and Week views must be perfectly vertically aligned — same header spacing, `auto-rows-fr` on grids. Switching Month → Week jumps to the week containing the 1st of that month. Week header renders "Aug 30 - Sep 5, 2026" on a single line. Task blocks fill the full grid-cell width, use compact Todo Mate-style rounded corners and larger semibold labels, and keep `overflow-hidden whitespace-nowrap` hard clipping (NEVER truncate or `...`). Task image thumbnails inside Calendar task blocks span edge-to-edge across the block width without extra separation from the title area; title padding must not inset the image. Completed tasks show category color; uncompleted are `bg-[#374151]` / `text-gray-400`. Saturdays `text-blue-500`, Sundays `text-red-500`, today has a blue circle border.

For product-spec detail beyond the above (aesthetic descriptions and reference-app
parity notes), inspect `PRODUCT_NOTES.md` if that file exists; otherwise this section
is authoritative.

**UI preservation contract:** Existing shipped UI is part of the product contract even when a task is primarily behavioral. Unless a task explicitly requests a visual or interaction-design change, preserve the current layout, typography, colors, spacing, sizing, positioning, responsive behavior, visible controls, interaction chrome, and visual hierarchy. Bug fixes and refactors must not opportunistically restyle or rearrange neighboring UI. If satisfying a task would require a broader visual change, treat that as a separate product decision rather than silently widening scope.

## 3. Strict Constraints
- **Platform budget:** $0 for Apple while relying on PWA "Add to Home Screen"; $25
  one-time for Google Play if native distribution enters scope
- **Hosting:** Free managed cloud initially (Appwrite Singapore), easily self-hostable on a home NAS via Docker later
- **Performance:** Must load instantly (0ms) and work 100% offline
- **Mobile PWA Testing:** Local IP testing often fails due to Appwrite CORS and mobile OS SSL restrictions for background Service Worker API calls. Always use Cloudflare Tunnels (`cloudflared tunnel --url http://localhost:5173`) for reliable mobile testing, and whitelist the tunnel URL in Appwrite Platforms

## 4. The Locked Tech Stack
- **Frontend:** Vite + React 19 (TS) + React Router v7 + Tailwind CSS v3 + lucide-react + date-fns
- **Media & UI:** `browser-image-compression` (max 150KB base64), `emoji-picker-react` (used by message + task emoji pickers)
- **Local DB & Sync Engine:** RxDB v17 (`getRxStorageDexie` + `wrappedValidateAjvStorage`). **All six synced collections—tasks, categories, diary, settings, friendships, and messages—use generic `replicateRxCollection()` with Mosaic's guarded Appwrite TablesDB adapters.** Normal startup starts/resumes the same versioned `replicationIdentifier` directly; RxDB's persisted metadata owns restart checkpoints and pending offline writes. `src/db/sync.ts` no longer runs a normal compatibility writer. A local-only `syncMeta` collection records settled replication freshness, and only a >90-day stale freshness boundary invokes read-only full recovery before that collection's pilot starts. **Do not use the official `replicateAppwrite` plugin**: Mosaic requires TablesDB plus its mapping/permission/tombstone and Function-owned-write contracts.
- **Backend:** Appwrite TablesDB (SDK v26+).
- **Backend Functions:** `message-action` (Node.js 18) is the trusted application backend. It owns cross-user messaging/reaction writes and the permanent-account-erasure worker in §23.8. Its trusted hourly `x-appwrite-trigger: schedule` path retries accepted deletion jobs and runs idempotent 90-day tombstone GC; browser/user payloads cannot select that maintenance path. The checked-in execution-key scopes are `users.read`, `users.write`, `sessions.write`, `rows.read`, `rows.write`, `tables.read`, `files.read`, `files.write`, and `execution.write`; `tables.write` remains absent. `dr-backup` remains a separate source-read-only Function; `message-action` invokes its server-only privacy-marker route through Function execution rather than receiving R2 secrets. Actions are enumerated in §20.3; tombstone maintenance is specified in [tombstone retention](TOMBSTONE_RETENTION.md).
- **PWA:** `vite-plugin-pwa` (`registerType: 'prompt'`), with passive registration
  and activation after all old controlled clients close; see §15 and §24.9.
- **Auth:** React Context (`AuthProvider`) is the single source of truth for the authenticated user. See §23. `useAuth` is a thin consumer shim; no hook mounts its own `account.get()`.

## 5. Portable AI Workflow Boundary

See [AI workflow](AI_WORKFLOW.md) for capability-based execution and checkpoints.

## 5.1 Full-file Revision Transport

See [offline implementation output](AI_WORKFLOW.md#offline-implementation-output).

## 6. Appwrite 2.0 Strict Guardrails (CRITICAL)
- **Regional Endpoint:** Must use the specific regional endpoint found in the project URL (e.g., `https://sgp.cloud.appwrite.io/v1`), NOT the generic `cloud.appwrite.io`
- **Use TablesDB, NOT Databases:** All SDK calls must use the TablesDB service (e.g., `tablesDB.createRow`, `tablesDB.updateRow`), not the deprecated Databases service
- **Permission String Format:** Use the new format: `create("any")`, `read("any")`, `update("any")`, `delete("any")`. The old `"role:any"` formats are deprecated
- **Row-Level vs Table-Level Permissions (VERIFIED):** `Permission.create()` **does NOT apply to rows**. Applying it to a row throws an error. Row-level permissions must only ever be `[read, update, delete]`. The **`create` permission belongs on the TABLE-level permissions** in the Appwrite Console (e.g., grant `create("users")` at the table level so authenticated users can insert new rows). If new-row sync fails with 401/403, the fix is in the Console, NOT in `buildRowPermissions`
- **`updateRow` vs `upsertRow` (CRITICAL, §0 item 4):** `upsertRow` is a **full replace (PUT semantics)** in Appwrite 2.0 — any column omitted from `data` is reset to its column default. `updateRow` is a **PATCH** — omitted columns are left untouched. The sync engine **must** use `updateRow` for rows that already exist remotely, and `createRow` for brand-new rows. Failing to do this caused `read_at` on outgoing messages to be wiped on every sync cycle. **Do NOT use `upsertRow` as a fallback for a 404 on `updateRow`** — `createRow` is a strict insert with no PUT semantics and is the correct choice.
- **Enforceable browser SDK boundary (#434):** `guardedTablesDB` intentionally exposes only `listRows`, `getRow`, `updateRow`, and `createRow`. No remote `upsertRow` (full replace) or `deleteRow` (bypasses tombstones) is available from feature modules; account-erasure/retention hard deletion remains server-owned. Local RxDB `collection.upsert` and the legacy social outbox action `kind: 'upsertRow'` are **not** remote TablesDB upsert calls. ESLint also rejects raw Appwrite SDK service constructors and namespace imports outside `src/lib/sdk.ts`/`src/lib/appwrite.ts`; safe `Query`/`Permission`/`Role` helpers remain allowed.
- **Cross-User Writes Go Through Appwrite Functions (§0 item 7):** A user can only assign permissions they themselves hold. To write a row owned by another user (recipient's message copy, sender's task reaction, sender's read receipt), the write must be performed inside an Appwrite Function using its API key. Direct client writes to another user's row will 401/403 (see §20.3)
- **REST Endpoints:** Base path for tables is `/v1/tablesdb/{databaseId}/tables/{tableId}`
- **ID Mapping:** RxDB primary key `id` maps directly to Appwrite's `$id` column
- **Row ID Length Cap (CRITICAL, §0 item 3):** Appwrite `rowId` values must be **≤36 characters**, matching `[a-zA-Z0-9_]+`, and MUST NOT start with a leading underscore. Any locally-generated ID that will become a remote `rowId` (settings, diary, or deterministic composite IDs) must respect this limit. **Rule:** when building `${userId}_${key}` IDs, validate the total length; if it exceeds 36 chars, fall back to a deterministic hashed ID (see §11)
- **Session Management:** Appwrite sometimes auto-creates a session on signup. Always wrap `account.createEmailPasswordSession` in a `try/catch` during signup, and explicitly clear stale sessions (`account.deleteSession('current')`) before login to prevent "Session is already active" errors
- **`$sequence` Type Change:** In Appwrite 2.0, `$sequence` is now a `string` (was `int`). Currently unused in this codebase, but note it if you ever sort by sequence
- **`Parameters<T>` on SDK Methods Picks the Wrong Overload:** Appwrite's TablesDB/Storage/Functions methods are overloaded; TypeScript's built-in `Parameters<typeof method>` utility resolves to the **last** overload, which for these methods is a deprecated `(id: string, ...)` form. Never use `Parameters<>` to derive param types for these methods. Define the param shape explicitly in `src/lib/sdk.ts` and cast at the call boundary (`params as never`). See §15 for the guarded SDK surface.

## 7. UI/UX & Architectural Guardrails

**Unified route and motion defaults (issue #471):** All protected-route navigation methods (tab taps, detail links, Escape, Android/browser Back and Forward, gesture commits) share one directional policy in `routeTransitions` and one compositor in `MainLayout`. Primary tabs follow their fixed spatial sequence, detail pages enter from their parents and exit toward those parents, and `POP` honors the router's history index so Forward does not animate as Back. Initial/redirect/auth transitions are not animated. An already animated direct-manipulation swipe is never played again after navigation, and the outgoing page is inert on exit; retain chat viewport geometry and original single-owner providers.

The account-synced Preferences switch **Reduce animations** defaults OFF, cached per account for first paint; the OS reduced-motion preference always takes precedence. `AppearanceProvider` owns the effective choice and applies Motion's reduced-motion policy plus a semantic root attribute for CSS. Route and shared BottomSheet transitions honor it, as do Day View Swiper and Calendar/Todo Embla snapping. Keep direct pointer feedback and essential activity/loading status. Do not duplicate animation state machines inside new pages or globally suppress essential control behavior; nested sheets, menus, carousels and gestures have separate motion directions/owners.


**Navigation polish (#410/#416):** Opt-in synced Escape-as-Back honors modal, search, edit and focus ownership before safe route Back. Browser Back and Escape route transitions aim to reuse rightward swipe motion with reduced-motion support. Route wheel swipes must not steal native/nested vertical scroll, carousels or controls; Calendar/Todo Embla wheel input belongs to the calendar, not the primary route. Keep route data providers owned once and avoid duplicated subscriptions to render exit animations.


**Settings information hierarchy (issue #417):** Settings groups live account/preference actions, future-only destinations, data/sync transfers, version/update, and data deletion in named sections. Unavailable rows say Coming soon; backup timestamps sit next to Backup & Restore. Preserve collapsed Version/build info, nested commit disclosure, and account/data deletion confirmations. Keep shared theme semantics and SettingsRow; no extra Settings framework.



### UI behavior ownership (agent audit, issue #409)

Behavior should be shared **only when the state/action contract is identical**;
visual uniformity alone is not permission to change gesture priorities, thresholds,
scroll ownership, keyboard focus, or existing styles.

| Interaction surface | Existing behavior owner | Reuse decision and exception |
|---|---|---|
| Primary page and detail edge-back navigation | `protectedRoutes`, `PrimaryRouteSwipeSurface`, `primarySwipeNavigation` | **Metadata-driven default** for protected detail routes; existing edge gestures retain priority and legacy Settings paths preserve full-width swipes. Do not mix with bubble gestures. |
| Chat-bubble reply and task title/memo taps | `useBubbleGestures` | **Reuse existing hook**, but preserve independent callbacks, directions, tap timing, and long-press ownership |
| Day/month carousels | `useDayViewSwiper`, existing Swiper wiring | **Keep separate** from route and bubble gestures: carousel, sheet drag, and vertical scroll have different owners |
| Task/category drag and task selection | Task reorder runtime and `DayViewSheet` | **Keep isolated**: selection disables reorder; reorder has dedicated pointer sensors and cancellation rules |
| Sheet/dialog stack, native Back, and confirmations | `BottomSheet`, `ConfirmSheet`, `useFocusTrap` | **Automatic top-layer inertness, retained exit, root scroll/focus/Back ownership.** Feature sheets use controlled `isOpen`; exceptional non-sheet overlays explicitly opt out. See §13. |
| Bulk task update/delete partial failure | `runBulkTaskActions` + `DayViewSheet` | **Reuse settled-failure selection** so one failed item does not lose other selections; preserve existing feedback and retry |
| Custom keyboard-operable task selection and chat bubbles | `activateOnEnterOrSpace` | **Reuse identical Enter/Space activation** while retaining surface-specific actions; native input editing remains separate |
| Timed notices and prop/sheet reset | `useFeedback`, `usePropSync`, `useSheetReset` | **Prefer existing helpers** for new identical cases; chat timestamp toggling and focus behavior are distinct state machines |

Regression ownership: unit tests for pure policies and settled operations;
DOM tests for selection, keyboard semantics, and sheet focus; browser contracts
for real gesture arbitration, scrolling, history, and reduced-motion behavior.
See [test workflow](TEST_WORKFLOW.md) and [theme guide](THEMING.md). A physical
phone/desktop visual-and-touch check is **manual acceptance**, never implied by CI.
- **Dynamic Colors:** Category colors MUST be applied via inline styles (`style={{ backgroundColor: cat.color }}`) — never dynamic Tailwind strings. The user-selected app accent is a separate appearance token applied through root CSS custom properties; do not reuse category colors as semantic state colors.
- **Predefined Colors Only:** Category and app-accent pickers use the curated palettes in `src/constants/colors.ts`. No free-form hex inputs. Category palettes and accent palettes may share the `ColorPalettePicker` component while retaining separate allowed-color sets.
- **Bottom Sheet Standardization:** All modals MUST use `<BottomSheet>` (see §13). It MUST use `ReactDOM.createPortal` into `document.body` to escape parent z-index/overflow traps and sit above `BottomNav`. Drag-to-close is restricted to the header handle via Framer Motion `useDragControls` + `dragListener={false}` on the main container — prevents accidental closes while scrolling. On Android/Samsung browser or installed-PWA Back, open sheets are modal history layers: Back dismisses only the top sheet, repeated Back dismisses nested sheets top-first, and route/browser navigation resumes only after the sheet stack is empty.
- **Sticky Layout Rules:** `MainLayout` root must be `h-screen overflow-hidden`; `<main>` must be `flex-1 overflow-y-auto`. Without both, `position: sticky` misbehaves.
- **Non-Sticky Home Chrome:** On Home, the person carousel, profile header, Home toolbar, and calendar date header are intentionally NOT sticky — they scroll away so the calendar grid owns the viewport. Do not re-add `sticky top-0`.
- **Layout-Shift Reservation:** Any element whose visibility toggles (timestamps, status rows, hover controls) MUST always reserve its space — toggle opacity, never presence. Prevents the hover-flicker reflow loop.
- **Day View bulk selection:** Selection is scoped to the active day and exits on date navigation or outer-sheet close. Selected task rows use their category color, suppress completion/edit/memo/photo gestures, and expose bulk soft-delete, category move, date, Today/Tomorrow, and visibility actions. Bulk category move rereads the current owner/day/category state before writing, preserves already-destination selected tasks in place, appends incoming selected tasks in current Day View visual order (category order, then task order), normalizes every affected source plus destination group with one shared update timestamp, and fails closed if selected tasks or the destination category changed. Escape and Android Back exit selection before dismissing the Day View sheet; nested bulk sheets retain normal top-first dismissal.
- **Gesture Priority on Interactive Elements:** swipe > long-press > double-tap > single-tap. Single-tap is deferred ~300ms to distinguish from double-tap. Any tap on the same pointer sequence as a swipe or long-press MUST be suppressed via a flag on the gesture hook (see §21).
- **Nested Carousel Gesture Ownership:** horizontal swipes that begin inside the calendar carousel belong to the calendar and MUST NOT advance the outer friend/person carousel. Horizontal swipes outside the calendar may advance the friend/person carousel. Parent isolation must not cancel the child calendar's own pointer lifecycle.
- **RxDB Reserved Keywords:** NEVER use `deleted` as a field name in RxDB schemas (see §12).
- **Soft Deletes:** Synchronized deletes are represented by `isDeleted: true` tombstones. Tombstones are retained for 90 days by default; clients with an older incremental cursor perform a full pull, and the privileged tombstone GC may permanently delete tombstones older than the retention window. See `docs/TOMBSTONE_RETENTION.md`.
- **Strict ISO Dates:** All date fields MUST be ISO 8601 strings (`yyyy-MM-dd` for day keys, full `.toISOString()` for timestamps).
- **iOS Storage:** Must call `navigator.storage.persist()` on launch to prevent WebKit from purging IndexedDB.
- **Bottom navigation:** Bottom nav has 5 tabs: Home, Explore, Alerts, Chat, Me. Alerts renders the account-scoped activity feed described in §2.

## 8. Current Progress & State

See [roadmap](PLAN.md) for delivered work and backlog, [checkpoint](SESSION_STATE.md)
for the active task, and [test workflow](TEST_WORKFLOW.md) for verification commands.

## 9. Hook & State Conventions
- **Named return object, never array:** `{ <domain>, isLoading, ...mutators }`; mutators `useCallback`-wrapped.
- **User-scoped data guard:** any hook reading user data tracks `loadedUserId`; expose data only when it matches, else `[]` + `isLoading = true`. Prevents cross-user leakage during logout/login.
- **Depend on `user?.$id`, never the `user` object** — Appwrite object identity churn causes re-subscription storms.
- **Observable subscriptions:** RxDB reads use `query.$.subscribe(...)` in a `useEffect`, store + unsubscribe in cleanup, guard `setState` with `isMounted`.
- **Mutator signatures:** Add = `Omit<Doc, 'id'|'userId'|'createdAt'|'updatedAt'|'isDeleted'>`; Update = `(id, updates: Partial<Doc>)`; both `useCallback` with `user?.$id` in deps.
- **"Sync State From Props" pattern:** render-body reset — `const [syncedId, setSyncedId] = useState<string|null>(null); if (task?.id !== syncedId) { setSyncedId(task?.id ?? null); setEditedValue(null); } const value = editedValue ?? task?.field ?? '';`. Canonical replacement for useEffect-based prop-syncing (MemoSheet, DatePickerSheet, DayViewSheet).
- **Primitive-only deps in effects:** read `const taskId = task?.id ?? null` at component top; use `taskId` in effect body + deps. Never reference the whole `task` object inside the effect.
- **Debounced persistence in sheets:** debounce live reorder writes ~400ms inside a `useEffect` keyed on local items. Do not write on every drag tick.
- **In-flight ref guard for idempotent multi-row patches:** `markAllRead` and batch unsends need a `useRef<boolean>` guard; re-fetch each doc with `findOne(id).exec()` before patching — RxDB throws `CONFLICT` on stale revisions.
- **Optimistic + revert for cross-user writes:** apply local update first, call server, revert on failure. Persist a server-resolved row ID locally when returned. Delivery-timeout reverts SHOULD signal the caller via a return value (`toggleReaction → 'ok' | 'timeout'`) so the UI can toast (§21).
- **Auth is not a data hook:** `useAuth` consumes `AuthContext` (§23); it does not call `account.get()`, track `loadedUserId`, or own session state. Never add per-consumer auth state.
- **Async-first effects that set state:** all `setState` calls after the first `await`, or defer via `queueMicrotask`. Synchronous setState from an effect body triggers `react-hooks/set-state-in-effect`.
- **Context split for Fast Refresh:** a file exporting a React component MUST NOT also export a non-component value. Split context object/types from the provider (`authContext.ts` + `AuthProvider.tsx`); satisfies `react-refresh/only-export-components`.

## 10. Error Handling & Logging Conventions
- **Log prefix:** all `console.error`/`console.warn` prefixed with `[ComponentName]` or `[hookName]`. Active: `[useTasks]`, `[useMessages]`, `[useConversations]`, `[messageDelivery]`, `[messageActionQueue]`, `[socialOutbox]`, `[social]`, `[ChatPage]`, `[useFriendCalendar]`, `[PersonPane]`, `[FriendCalendarPage]`, `[Storage]`, `[Sync]`, `[Bootstrap]`, `[RxDB]`, `[CategoryManagerSheet]`, `[ReplyComposerSheet]`, `[EmojiPicker]`, `[SyncStatusSheet]`.
- **Guard clause errors:** log `[hookName] Cannot <action>: User not authenticated` and return silently — never throw on a logout race.
- **Silent session cleanup:** `try { await account.deleteSession('current') } catch {}` before any `createEmailPasswordSession` — intentional; ESLint `no-empty` has `allowEmptyCatch: true` (§15).
- **DEBUG gating:** non-error diagnostics wrapped in `if (import.meta.env.DEV)` or a module-level `DEBUG` flag.
- **Error surfacing:** fixed-position toast (`fixed bottom-24 left-1/2 -translate-x-1/2 z-[70]`) auto-dismissed at 2000ms (see DayViewSheet `deleteFeedback`, ChatPage `feedback`). No `alert()` except placeholder "Coming Soon". Sync-engine failures surface ONLY via `SyncStatusSheet` (Settings → Sync Status).
- **Invalid rowId recovery:** if sync logs `Invalid rowId` for a local doc it retries forever; the owning hook (`useSettings`) must scan + `remove()` legacy invalid rows in its init phase (§11).
- **`CONFLICT` is not an error:** `markAllRead`/`toggleReaction`/pull `upsert` paths catch `err.code === 'CONFLICT'`, re-fetch, retry once or skip. Never log it as an error. In the pull loop, `CONFLICT` on `upsert` preserves the local edit and the row is skipped without freezing the pull boundary.
- **Fire-and-forget cross-user writes:** `markReadOnRemote`, `unsendOnRemote`, `reactOnRemote`, `reactToTaskOnRemote` log and swallow. Local state is source of truth. `mark_read`/`unsend` enqueue into `messageActionQueue` on transient failure; `react`/`react_to_task` do not (they have optimistic-revert + user-visible feedback).
- **Friendship command failures:** `friendshipCommands.ts` persists account-scoped, versioned intents, serializes delivery across tabs, and drops permanent failures or exhausted retries visibly. Dependent commands are discarded with a failed predecessor. Friendship cache rows are server-owned; failures remove pending UI overlays and never revert confirmed server data. Profile retries remain in `socialOutbox.ts`.
- **Differentiate "Not Logged In" from "Couldn't Check" (§0 item 8):** 401 from `account.get()` = definitely not logged in → clear user state. Network error / timeout / offline = couldn't check → `isOffline = true` and `AppLayout` renders a retry screen. Use `OfflineError`/`isOfflineError()` from `src/lib/authEvents.ts`; never construct ad-hoc "offline" strings.
- **Logout returns success:** `useAuth().logout()` returns `Promise<boolean>`. Callers MUST check before navigating (`SettingsPage`, `AccountPage`). See §23.
- **Multi-tab auth broadcast:** login/logout write `{ type: 'login'|'logout', at: number }` to `localStorage` key `mosaic_auth_broadcast`. Other tabs listen via `storage` and clear user state or re-run `account.get()`. Never broadcast tokens — only the event type.

## 11. ID Generation & Naming
- **Client-generated IDs (no server round-trip), typed prefix:**
  - Tasks: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Categories: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Messages (sender's local row): `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Images: `img_${crypto.randomUUID().replace(/-/g, '')}` (with a `getRandomValues` fallback for iOS)
  - Deterministic composite IDs (settings, diary): `${userId}_${key}` or `${userId}_${date}` — only when total length ≤36 chars (§6 row cap)
- **`msg_` prefix is server-enforced:** `message-action.handleDeliver` rejects any `messageId` not starting with `msg_` (`Invalid messageId format`, HTTP 400). Server guard defends against direct SDK calls (§20.3).
- **Thread IDs:** `th_${sha256Hex(sortedUserIdA + '|' + sortedUserIdB).slice(0, 30)}` — deterministic, both participants compute the same value, 33 chars total. Helper: `makeThreadId(userA, userB)` in `src/lib/threads.ts`.
- **Recipient row IDs:** `rmsg_${sha256Hex(senderMessageId).slice(0, 30)}` — deterministic, sender's client computes it without a round-trip. Helper: `makeRecipientRowId(senderMessageId)` in `src/lib/threads.ts`.
- **Settings row ID hashing:** `${userId}_${key}` easily exceeds 36 chars for long keys. `useSettings` uses `makeSettingsRowId(userId, key)`: (1) if `${userId}_${key}` ≤36 chars → use as-is; (2) otherwise `s_${hashString(userId + '_' + key)}` where `hashString` is a deterministic dual-djb2 variant producing ~12–14 base36 chars. New long settings keys get valid row IDs automatically.
- **Friendship row IDs:** `fr_${hex.slice(0, 32)}` from `${ownerId}|${friendId}` (35 chars, safe).
- **Random suffix convention:** `.substr(2, 9)`. Reserve `.slice(n, m)` for truncating deterministic hashes.

## 12. Field Naming & Serialization
- **Local ↔ Remote mapping:**
  - RxDB camelCase; Appwrite TablesDB columns snake_case.
  - All mapping centralized in `src/db/sync.ts` (`toAppwriteFormat`/`fromAppwriteFormat`). Never map ad-hoc in hooks/components.
  - `isDeleted` (local) ↔ `deleted` (remote) — hard rule because `deleted` is a reserved RxDB keyword (§0 item 1).
  - Booleans encoded as booleans, not 0/1.
  - `updatedAt` (local) ↔ `updated_at` (remote) — every synced collection participating in the `usesTimestamps` pull-winner predicate has it. `categories` and `settings` gained it in the 2026-09-16 D6 migration (see Changelog; historical D6 backend migration (the production-targeted one-off script is retired; current shape is owned by `infrastructure/mosaic-backend.mjs` and the Appwrite backend workflow)).
- **`messages` field mapping:** `threadId`→`thread_id`; `senderId`→`sender_id`; `recipientId`→`recipient_id`; `direction`→`direction`; `taskRefId`→`task_ref_id`; `taskRefTitle`→`task_ref_title`; `taskRefDate`→`task_ref_date`; `taskRefColor`→`task_ref_color`; `replyToId`→`reply_to_id`; `replyToContent`→`reply_to_content`; `replyToSenderId`→`reply_to_sender_id`; `isUnsent`→`is_unsent`; `originalMessageId`→`original_message_id`; `reactions`→`reactions`; `readAt`→`read_at`; `deliveryStatus`→`delivery_status`.
- **`read_at` is server-owned on outgoing rows (§0 item 5):** `toAppwriteFormat` for `messages` MUST omit `read_at` when `direction === 'outgoing'` — the client would overwrite the `mark_read` receipt. Applies only to `messages`. On pull, the server-owned `read_at` on an outgoing row is applied BEFORE the dirty-skip so a locally-dirty outgoing message still receives the receipt.
- **Date storage:** day keys `yyyy-MM-dd` via `date-fns.format`; timestamps full ISO 8601 via `.toISOString()`. Compare timestamps with the `toMs()` helper (`Number.isFinite` guard).
- **Empty-string over null:** optional string fields (`memo`, `image`, `completedAt`, `icon`, `friendBio`, `threadId`, `replyToId`, `replyToContent`, `replyToSenderId`, `originalMessageId`, `reactions`, `readAt`, `updatedAt`) default to `''` — never `null`/`undefined` — so RxDB validation never fails.
- **Reactions format:** JSON string of `Array<{ emoji: string; userIds: string[] }>`. Serialized as `''` when empty (not `'[]'`). Parse/stringify only via `src/lib/reactionUtils.ts`.
- **Schema migrations:** adding an optional field to an existing RxDB collection requires (1) bump schema `version`, (2) add a `migrationStrategies` entry in `database.ts` backfilling `''` (or `false` for booleans), (3) update both `toAppwriteFormat` and `fromAppwriteFormat`, (4) update `KNOWN_FIELDS` (drift detection), (5) add the next numbered idempotent Appwrite migration through `scripts/appwrite-migrate.mjs` and the [Appwrite backend workflow](APPWRITE_BACKEND_WORKFLOW.md). `tests/helpers/testDb.ts` mirrors `database.ts`'s strategies and MUST be updated in lock-step — see §24.5. Any non-RxDB mapper constructing the same doc type (e.g. `friendData.mapCategoryRow`) MUST be updated in the same patch or the build fails on the missing required field.

## 13. Modal & Bottom Sheet Structure
- **Default modal ownership (#409):** `BottomSheet` supplies drag handle, entrance and exit transitions, Escape/browser-history/Android Back, app-root inertness, focus trap, and ref-counted scroll lock through the exit. Its active portal is the sole keyboard/pointer owner; underlying open sheets are inert and aria-hidden automatically, with focus returning to the previous layer after dismissal. Keep these defaults centralized rather than reimplementing them in feature sheets.
- **Controlled lifetime:** do not conditionally unmount a `BottomSheet` owner merely because `isOpen` changes to false: retain the owner and pass `isOpen={false}` until `onExitComplete` when the owning feature needs to drop its data. This is essential for portal exit animations; wrapping an immediately unmounted owner in another `AnimatePresence` does not guarantee exit.
- **Reopening lifecycle:** a `BottomSheet` initially rendered closed must arm its retained-exit state on every open. Back, header drag and backdrop may close it, but the portal must survive until its downward animation completes. Regression-test the closed → open → close sequence, not only initially-open sheets.
- **Data clearing on dismissal:** data-backed task, message and friend sheets use `useRetainedSheetValue` to keep the last entity displayed until `onExitComplete`. Caller owners stay mounted with `isOpen={false}`; conditional `{isOpen && <FeatureSheet />}` bypasses the shared animation.
- **Route defaults:** protected pages are declared in `src/lib/protectedRoutes.ts`; `App.tsx` generates their `Route` entries. New detail pages specify a parent and owning tab once and inherit edge-back, history fallback, and layout settings. Existing Settings routes explicitly preserve the previously full-width swipe mode, and Notifications Settings accepts only Settings/Alerts origins.
- **One sheet = one file.** Props `{ isOpen, onClose, <entity>, onSave/onConfirm }`. No context-based orchestration. Primitive rules: §7.
- **Nested sheet choreography:** a new top `BottomSheet` automatically suspends underlying sheet focus/pointer access. Preserve domain-specific `isLocked` when underlying drag/reorder must also be disabled, and `suspendInteraction` for non-BottomSheet overlays (such as PhotoSwipe); do not hand-roll modal stack inertness.
- **Sheet locking semantics:** `isLocked` disables drag/swipe interaction but preserves ordinary dismissal semantics. `preventDismiss` is the stronger in-flight guard: backdrop, Escape, and browser/Android Back must not dismiss the sheet while it is true. Use `preventDismiss` only while an operation must finish without the modal disappearing.
- **Action sheets close themselves before opening a sibling:** `onClick={() => { onX(); onClose(); }}` — the action sheet must visually dismiss first.
- **Sheet content padding:** `pt-2 pb-8 px-4` (or `px-1` for full-width lists). No extra wrappers.
- **Delete confirmations:** destructive flows open a nested `BottomSheet` with `isLocked={true}` and a two-button `[Cancel | Delete]` row (`bg-[#2A2A2A]` / `bg-red-500`). `window.confirm` is BANNED in sheets. References: DayViewSheet "Delete Photo", CategoryManagerSheet "Delete Category", ChatPage "Unsend Message".
- **Deleting state:** nested delete-confirm sheets track local `isDeleting` and render a spinner inside the Delete button while in flight.
- **Reorderable sheets:** Framer Motion `Reorder.Group`/`Reorder.Item` with `dragListener={false}` on the item and a dedicated grip handle calling `dragControls.start(e)`. Never whole-row drag in a scrollable sheet. This manager-sheet rule still governs Categories and similar settings lists; Day View task rows use the explicit delayed dnd-kit title-handle contract in §2 instead.

## 14. Component Conventions
- **Named exports only** (`export const Foo: React.FC<Props> = ...`); default export only for `App.tsx`.
- **Props interface above component:** `interface XxxProps { ... }` immediately above; never inline.
- **Memo + displayName:** any `React.memo` component MUST set `.displayName`.
- **Prop callbacks:** internal handlers `handleX` (useCallback if passed to children or used in effect deps); external props `onX`.
- **Stop event leakage in lists:** buttons/inputs inside tappable rows MUST `onPointerDown={(e) => e.stopPropagation()}` — critical inside Swiper slides and message bubbles.
- **Animation tokens:** entry via `animate-in fade-in duration-300` or `animate-in fade-in slide-in-from-<dir>-1 duration-200`; Framer Motion `whileTap={{ scale: 0.95–0.98 }}` on all tappables.
- **Spinner primitive:** ALWAYS `<div className="w-N h-N border-2 border-white border-t-transparent rounded-full animate-spin" />`. No SVG/library spinners.
- **Unified gesture hooks:** application-owned gesture recognition stays in one state machine (`useBubbleGestures`); do not stack competing custom tap/swipe/long-press hooks. The Day View sortable title is the narrow exception for library-owned drag recognition: `useBubbleGestures` continues to own single/double/triple-tap disambiguation, while dnd-kit's delayed sortable sensor exclusively owns drag activation/movement. Do not reimplement that drag lifecycle inside `useBubbleGestures`. Refs hold internal gesture state; only `swipeOffset`/`isSwiping` use React state, throttled with `requestAnimationFrame`.
- **`Button variant="icon"` requires `aria-label`.** Icon-only buttons have no text content; without a label they are silent to screen readers. The label describes the action, not the icon ("Close", not "X"). Documented obligation, not lintable — every new icon-variant button must supply a label.
- **Interactive `motion.div` MUST be `motion.button`.** A `<div>` with a click handler is not focusable, not keyboard-activatable, and not announced as a control. If an element owns a tap handler, use the semantic element (`<button>` / `motion.button`); if a semantic element is impossible, supply `role`, `tabIndex`, and keyboard handlers.
- **Primitives carry `focus-visible` rings.** Every focusable primitive (`Button`, `Input`, `SettingsRow`, etc.) has a `focus-visible:ring` so keyboard users can locate focus. Full-width rows use `focus-visible:ring-inset` to prevent clipping.
- **Label association via `htmlFor`/`useId`.** `<Input label>` binds via `htmlFor` + a `useId()`-generated id. Never rely on `placeholder` as the label — placeholders are invisible to screen readers once the input has value.

## 15. File Organization Rules
- `src/components/ui/` — pure, entity-agnostic primitives.
- `src/components/layout/` — chrome wrapping routes.
- `src/components/home/` — Home page feature components.
- `src/components/home/views/` — calendar sub-views + sub-sheets + `useCalendarState`.
- `src/components/friend/` — read-only friend views.
- `src/components/messages/` — chat feature.
- `src/components/explore/` — social graph UI.
- `src/components/modals/` — account/settings modals.
- `src/hooks/` — one hook per data domain plus focused utilities. **Trios (context object + provider + selector, kept split to satisfy `react-refresh/only-export-components`):** auth (`authContext.ts`/`AuthProvider.tsx`/`useAuth.ts`), conversations (`conversationsContext.ts`/`ConversationsProvider.tsx`/`useConversations.ts`), friends (`friendsContext.ts`/`FriendsProvider.tsx`/`useFriends.ts`). `FriendsProvider` MUST be mounted above `ConversationsProvider`; the latter consumes the former. Do not merge any trio.
- `src/lib/` — side-effectful SDK wrappers + pure utilities. No React imports allowed here (except `useFriendCalendar.ts`, a hook living under lib/ for historical reasons — do not move).
- `src/lib/authEvents.ts` — pure module: `AUTH_UNAUTHORIZED_EVENT`, `isUnauthorizedError(err)`, `makeUnauthorizedError(message?)`, `OfflineError` + `isOfflineError(err)`, `dispatchUnauthorized()`, `guardedCall<T>(fn)`. No React.
- `src/lib/sdk.ts` — **the guarded SDK surface.** Exports `guardedTablesDB`, `guardedStorage`, `guardedFunctions`, `guardedAccount`. Param shapes explicitly defined (see §6 re: `Parameters<T>`). Raw SDK service classes (`TablesDB`, `Storage`, `Functions`, `Account`) may only be imported and constructed here and in `src/lib/appwrite.ts`. Enforced by ESLint `no-restricted-imports`. `guardedFunctions.createExecution` normalizes `responseStatusCode === 401` into `makeUnauthorizedError()` before guardedCall's dispatch can miss it.
- `src/lib/appwrite.ts` — the only other file permitted to construct raw `Client`/`Account`. Exports `client` and `account` used by `sdk.ts`.
- `src/lib/messageActionQueue.ts` — persistent retry queue for `mark_read`/`unsend`. Storage: JSON array under `mosaic_message_action_queue`. Dedup `(userId, dedupKey)`. Cap 100. Retries up to 5 on transient; drops on 401 / non-429 4xx. Single in-flight flush guard. Wired to `sendMessageAction` at module init; flushed by `deliverPendingMessages` (§20.5).
- `src/lib/socialOutbox.ts` — persistent retry queue for cross-user social writes (`sendFriendRequest`, `acceptFriendRequest`, `deleteFriendPair`, `blockFriend`, `createOrUpdateProfile`). Storage: JSON array under `mosaic_social_outbox`. Dedup `(userId, dedupKey)`. Cap 100. Retries up to 5 on transient; drops on 401 / non-429 4xx. Permanent drops emit `SocialOutboxFailureEvent` to `subscribeToSocialOutboxFailures` — `FriendsProvider` reverts the local row. Wired to `guardedTablesDB` at module init in `social.ts`; flushed by `AppLayout`'s `tryDeliver` alongside `deliverPendingMessages` (§10).
- `src/lib/imageCache.ts` — **single owner of the IndexedDB blob cache for downloaded image files** (keyed by `fileId`). `storage.ts` and `exportData.ts` consume it via `getCachedImage`/`cacheImage`/`deleteCachedImage`; do not open the cache DB directly elsewhere. Version 2 adds a separate metadata store and a 50 MiB LRU budget; see §24.12.
- **Code-splitting boundaries.** `src/App.tsx` lazily imports every page/route while
  `AppLayout`, auth/database boot, and the `FriendsProvider` → `ConversationsProvider`
  ownership chain stay eager. Emoji picker, image compressor, export ZIP code, and
  PhotoSwipe lightbox load only when their interactions request them. Authenticated
  background work that is not required to paint the shell—sync, realtime, and pending-message
  delivery—must stay behind dynamic imports/effects so those modules do not inflate
  synchronous startup parse/evaluation. Social-outbox flushing also stays post-render;
  its failure-subscription module may remain eager because optimistic-revert ownership
  depends on that listener. Preserve these boundaries
  when adding shared imports; `scripts/audit-bundle.mjs` reports the graph.
- `src/lib/chunkLoadErrors.ts` records Vite's exact `vite:preloadError` payload and
  recognizes browser fallback messages. Route boundaries offer an explicit full-page
  reload for failed lazy imports; ordinary render errors keep the in-place retry.
  Do not automatically reload because a form or other unsaved local UI state may exist.
- **Image-acquisition boundary.** `useTaskImage(fileId, enabled)` must not call the
  IndexedDB/Appwrite path while disabled. `useImageLoadGate` enables content within a
  200px visibility margin and latches after first enablement. `DeferredAvatar` is the
  standard persisted-avatar renderer. Keep selected headers and opened viewers eager;
  use the visibility gate for scroll rows, calendar blocks, and selected-day items.
- **Service-worker scope.** `vite-plugin-pwa` owns the SW registration at root scope.
  Do not register a second SW or precache user-generated content. Precache the app
  shell including lazy JS/CSS chunks so offline routes remain available. RxDB and
  `imageCache.ts` retain ownership of user data. The SW is production-only.
- **Update policy (PWA-4, completed 2026-09-20).** Use `registerType: 'prompt'` with
  `injectRegister: false`, `skipWaiting: false`, and `clientsClaim: false`.
  `pwaLifecycle.ts` is the single registrar. A downloaded update remains waiting until
  the user chooses **Update now** or all controlled clients close. Only that explicit
  action sends `SKIP_WAITING`; takeover then reloads the page. **Later** leaves the old
  worker active and preserves unsaved state. On first install, the worker does not claim
  the already-open page; a subsequent navigation can be controlled. Never add an
  automatic reload or activation request as routine error handling.
- **Why `autoUpdate` was removed.** The plugin forced both activation flags to true
  despite the config's false values. The the bundle-size budget and Git history records the
  original finding. Workbox still emits a conditional `SKIP_WAITING` message handler
  with the corrected policy; a text search for `skipWaiting()` cannot distinguish
  this from immediate activation. Build verification inspects execution (see §24.9).
- `scripts/` — build-time and workflow utilities: targeted dumps, compact AI handoffs, shared clipboard support, and one-off Appwrite migration scripts.
- `tests/` — Vitest suite (three projects) plus discovery and benchmark tooling. See §24.
- Project root: `apply-changes.mjs` (installer; copies run output to clipboard on exit), `pending-changes.txt` (gitignored input).

**ESLint enforcement of the SDK surface (`eslint.config.js`):**
- `globalIgnores` includes `['dist', '.mosaic-backup']` — the installer writes full-file snapshots to `.mosaic-backup` that can contain pre-fix code failing lint if scanned.
- For `**/*.{ts,tsx}`, `no-restricted-imports` forbids importing `TablesDB`, `Storage`, `Functions`, or `Account` from `'appwrite'`; message directs to `src/lib/sdk.ts`.
- For `**/*.{ts,tsx}`, `no-empty` is `['error', { allowEmptyCatch: true }]` — permits intentional `catch {}` cleanups (§10) without a placeholder comment that Repomix strips.
- A per-file override turns `no-restricted-imports` off for `src/lib/sdk.ts` and `src/lib/appwrite.ts` — the two legitimate construction sites.

## 16. List Rendering & Sorting

1. **Sort contracts live in hooks, not components.** Tasks `[{date:'asc'},{createdAt:'desc'}]`; Categories `[{order:'asc'}]`; Diary `[{date:'desc'}]`; Messages in-thread `[{createdAt:'asc'}]`; Conversation list computed client-side per thread descending; Friends user order then alphabetical (`friendDisplayName || friendUsername`).
2. **Grouping is memoized.** Any grouping (tasks-by-category, tasks-by-date, messages-by-thread) returns a `useMemo` Map/Record — never a `filter()` inside `.map()`.
3. **Empty arrays are module constants.** `const EMPTY_TASKS: TaskDocument[] = []` keeps `React.memo` prop equality stable.
4. **Calendar slides are windowed without per-frame React work.** `useCalendarState` exposes `renderStart`/`renderEnd` from Embla's selected snap + `focusDate` index, expanded by `RENDER_WINDOW = 1`. `CalendarBody`/`FriendCalendarView` render slide content only inside the window; all 61 (or 25) slide containers remain emitted so Embla geometry is unchanged. The active slide plus both immediate neighbors are already mounted before a one-step drag, so do not subscribe React state to Embla's per-frame `scroll` event solely to move this render window. Do not un-window.
5. **Tasks are indexed once.** `CalendarBody`/`FriendCalendarView` compute `tasksByDate: Map<string, TaskDocument[]>` via `useMemo` keyed on `tasks`; pass the Map (not the array) into `MonthView`/`WeekView`; `DayCell` receives a per-day slice. Never reintroduce a per-day `.filter()`.
6. **`MonthView`/`WeekView` memoize their day arrays.** `calendarDays`/`weekDays` are `useMemo`-ized on `focusDate` so each `DayCell`'s `date` prop is referentially stable — without it `React.memo` on `DayCell` never bails.
7. **`DayCell` is memoized and prop-stable.** Receives `date` (stable), `tasks` (Map slice, `EMPTY_TASKS` for empty days), `categories` (parent `useMemo`), `isCurrentMonth` (primitive), `onDayClick` (parent `useCallback`). Builds its click closure internally. Sorting runs only when `tasks.length > 1` and is memoized on `tasks`.
8. **`CalendarBody` is memoized.** `PersonPane` re-renders on toast/`activeView` changes; `CalendarBody` bails via `React.memo` unless a stable prop changed.
9. **Friend-calendar refetch on activation.** `PersonPane` forces `refetchFriendCalendar(true)` when a friend pane becomes active, throttled by `FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`. Own pane stays live via RxDB subscription. Do not rely on cache TTL alone.
10. **`useTaskImage` shares and gates object URLs.** Module-level `Map<fileId,{url,refCount,revokeTimer}>` ref-counts URLs across hook instances with a 1.5s deferred revoke so StrictMode double-mounts, Month↔Week toggles, and slide re-entry don't tear down + re-read. Its `enabled` argument gates the upstream IndexedDB/Appwrite acquisition. `useImageLoadGate` latches after a 200px visibility margin; `DeferredAvatar` composes both hooks. Do not bypass this path in calendar cells or persisted-avatar UI.
11. **`DayViewSheet`/`HomePage` use manual windowing.** `RENDER_WINDOW = 3` for `DayViewSheet`; `HomePage` starts at `INITIAL_RENDER_WINDOW = 0` and expands to `RENDER_WINDOW = 1` during idle time, keeping the first Home commit to the active person pane. Day View keeps all Swiper slide containers for geometry but mounts the date-navigation and task trees only inside that seven-slide window. Load-bearing for scroll smoothness.
12. **One subscription per collection, one provider per collection.** `ConversationsProvider` (mounted in `AppLayout`) is the sole owner of the inbox `db.messages` subscription and the sole caller of `useFriends()` for badge/chat-list. `FriendsProvider` (mounted above it) owns the `db.friendships` subscription. `useConversations`/`useUnreadMessages`/`useFriends` are thin context selectors — they MUST NOT mount their own RxDB subscriptions.
13. **Unread math excludes `isUnsent`.** Counter is `direction === 'incoming' && !readAt && !isUnsent` — required for consistency with `ChatPage`'s own unread check. Regression tests pin this.
14. **Conversation grouping is by counterpart, not thread.** Groups by the other participant id (`senderId === userId ? recipientId : senderId`). Relies on `makeThreadId` being a pure function of the participant pair. Do not introduce rows whose `threadId` is not derived from `senderId`/`recipientId`.
15. **`lastMessage` depends on RxDB sort order.** Inbox `lastMessage` is `msgs[0]`, correct only because the provider queries `sort: [{createdAt:'desc'}]`. Do not drop that sort in favor of client-side sorting.
16. **`ConversationRow` is memoized with a custom comparator.** Keys on `threadId`, `unreadCount`, friend identity (`friendId`, `friendDisplayName`, `friendUsername`, `friendAvatarFileId`), and the `lastMessage` fields that affect rendering (`id`, `content`, `taskRefTitle`, `direction`, `createdAt`, `isUnsent`). Any new rendered field MUST be added to the comparator or the memo swallows the update.
17. **Friend panes do not subscribe to owner task/category collections.** `PersonPane` keeps its hook order stable but disables the owner RxDB collection hooks unless `person.kind === 'me'`; the adjacent friend panes kept mounted by Home windowing must not multiply owner collection subscriptions.
18. **Person-pill memoization requires stable action props.** `PersonCarousel` passes one stable `onSelect(personId)` callback into memoized pills instead of allocating a new closure prop for every pill on every active-person render.
19. **Calendar day-cell tap feedback is CSS-owned.** Month/week grids can mount hundreds of day cells across the render window; `DayCell` uses CSS active-scale feedback rather than a Framer Motion controller per cell.
20. **Mapped RxDB hook data preserves identity between emissions.** `useRxCollection` memoizes its public mapped value from the current document array; parent renders that do not receive a new RxDB emission MUST reuse the same mapped object/array reference so downstream `useMemo`/memoized consumers can bail.
21. **Home Swiper avoids DOM observers.** Person-list changes already call the explicit Swiper update path; do not enable Swiper `observer`/`observeParents` mutation observers on the Home carousel.
22. **Inbox aggregation is single-pass.** `ConversationsProvider` derives each counterpart's newest message and unread count in one pass over the already newest-first message stream; do not allocate per-friend message arrays only to scan them again.
23. **Unread badge updates are context-isolated.** `useUnreadMessages` consumes a dedicated unread summary value owned by `ConversationsProvider`; conversation-list changes that leave `totalUnread`/loading unchanged must not rerender the global BottomNav badge consumer.
24. **Conversation-detail aggregation is route-gated.** Outside the Messages/Chat routes, the provider still maintains the correct accepted-friend unread total but skips allocating/sorting the per-friend conversation list. Entering a Messages route derives the list from the latest subscribed rows without adding another RxDB subscription.
25. **Bottom-nav indicator is CSS-owned.** Keep one persistent indicator and move it by transform between the five tab slots. Do not make the global shell import Framer Motion solely for the active-tab dot; route/sheet motion can remain lazy with the feature chunks that use it.
26. **Todo compact-month rendering is windowed.** `TodoCalendarGrid` mounts only the active compact month plus one immediate neighbor on each side (`RENDER_WINDOW = 1`); the remaining slide containers stay empty so Embla geometry is stable. The primary Calendar likewise makes only its rendered three-slide window vertically scrollable; empty geometry slides remain non-scrolling. Calendar carousel tracks should remain compositor-friendly rather than adding per-frame React rendering work.
27. **Animation scheduling stays owner-native.** Do not wrap all animations in an application-level `requestAnimationFrame` loop. CSS/compositor transitions and Swiper, Embla, or Framer motion should keep their native frame scheduling; use custom rAF only for a genuinely custom JavaScript visual loop or frame-batched DOM measurement/write path. Performance work should first remove React state, layout, allocation, and paint pressure from frame-critical gesture paths.


28. **Owner Day View completion-order preference is a view projection.** Synced `taskCompletionSort` accepts `manual` (default), `completed-first`, `completed-last` within each category, shared by Calendar Day View and Todo's inline Day View. Manual placement from persisted `task.order` remains the source of truth; checking tasks or changing this preference does not persist any reorder. Clipboard export follows visible per-category grouping. All same-category and cross-category drag targets still work in auto modes: drop destination category wins, but completion grouping takes precedence over the exact dropped position; translate same-status peer positions back into canonical order instead of persisting display order or changing completion. Guard drag commits against stale membership, status, date or owner identity. Friend views are unaffected.


## 17. Native Input Quirks
- **Theme-aware native controls:** date and other native form controls inherit Mosaic’s resolved color scheme (`light` in Light; `dark` in Dark/Black/System-dark). Do not hard-code `[color-scheme:dark]` now that appearance is selectable.
- **Focus management:** focus sheets/inline inputs via `useRef` + `useEffect` on `[isOpen, taskId]`. NEVER `autoFocus` — Safari/iOS ignores it inside conditionally-rendered subtrees (any AnimatePresence-wrapped BottomSheet).
- **File input reset:** after an `<input type="file">` upload (success OR failure), reset `fileInputRef.current.value = ''` so the same file can be re-selected.
- **Body scroll lock:** BottomSheet is the only component allowed to touch `document.body.style.overflow`; it uses a module-level `openSheetCount` counter for nested sheets.
- **`touch-action: pan-y` on gesture-enabled elements:** any element owning horizontal gesture handlers MUST set `touchAction: 'pan-y'` inline, else iOS Safari interprets the swipe as back-navigation and suppresses vertical scroll.

## 18. Async & Race Safety
- **Cancellation ref:** every async `useEffect` has a local `let isMounted = true` flag checked before `setState` in every continuation; cleanup sets it false.
- **Programmatic-move guards:** set `isProgrammaticMoveRef.current = true` before `.slideTo()`/`.scrollTo()`, clear in a `requestAnimationFrame`; handlers check the ref to ignore self-induced events — prevents infinite feedback loops.
- **Re-entrancy guards:** the sync coordinator coalesces same-tab startup/resync requests, while message delivery coalesces only work for the same authenticated owner/generation. A request for a newer owner waits for the previous generation to retire and then runs for the current owner instead of being swallowed by the old loop.
- **Bounded active-device catch-up:** focus, online, and visible transitions still request an immediate debounced `forceSync()`. `AppLayout` also runs a tiny 120-second watchdog while the authenticated app is visible, online, and DB-ready; each tick requests the same incremental six-pilot resync through the existing lazy sync import. This bounds a missed Appwrite Realtime reconnect gap without adding full scans or moving sync into the startup graph.
- **RxDB owns normal restart/resume:** an inactive collection pilot starts directly with its stable versioned `replicationIdentifier`. If RxDB metadata already exists, its upstream/downstream checkpoints and pending writes resume automatically. Normal startup must not run a second browser writer over local cache rows.
- **Fresh-sync barrier for safety-sensitive restore/import:** `initializeSync()` activates/resyncs the six pilots and may run read-only stale recovery when a local freshness proof is older than the tombstone horizon. Callers that must prove a fresh server snapshot use `refreshSync()`: it drains any in-flight coordinator work, requires every pilot to be active for the current owner, requests RxDB resync, and requires every pilot refresh to return `true` after `awaitInSync()`. The six independent pilot freshness proofs are launched together against the same remaining deadline; they must not be awaited sequentially, because a slow earlier collection would otherwise starve later collections of their freshness budget and create false collection-specific timeouts. Collection completion publishes coarse 0–100% sync progress. RxDB only runs live replication in its elected leader tab. Manual freshness requests wait up to 10 seconds (bounded by the remaining caller deadline) for a local browser/PWA leader election instead of prematurely assuming another tab after one second; a failed election reports a local-leadership timeout without asserting that a different physical device is blocking it. Separate laptop/phone IndexedDB origins and leader elections never coordinate through Appwrite. Web Lock acquisition is part of the same caller deadline and is aborted at timeout; if the Web Locks API exists but lock acquisition fails, Mosaic fails closed rather than running unlocked. `lastSync` is stamped only after all six collections prove freshness. A freshness timeout does not stop live replication, so the status surface reports it as **sync still finishing** rather than persisting a red collection failure; callers that require proven freshness still receive the rejection and remain fail-closed.
- **Authenticated work generation:** `src/lib/accountWorkScope.ts` maintains the current authenticated owner + generation. AuthProvider invalidates it before login/signup/logout session mutation and establishes the new owner as soon as identity is known. Sync, message delivery, and generic retry flushing capture that generation and stop scheduling owner-specific work when it becomes stale. Sync status/backoff/retry side effects are likewise generation-guarded, and teardown clears a scheduled backoff wake only when that timer belongs to the owner being suspended, so delayed old-account cleanup cannot cancel a newer account's retry.
- **Local replication freshness is DB-scoped:** `syncMeta` is a local-only RxDB collection keyed by account + synced collection. It stores the current replication identifier and the last settled in-sync timestamp. Because it lives in the same database, deleting/replacing IndexedDB also deletes the proof; it is never synced to Appwrite. The legacy account-scoped `lastSyncTimePerCollection` pull cursor is migration fallback only when no current freshness marker exists.
- **Freshness is recorded only after proven convergence:** each pilot waits for RxDB's public initial-replication completion before recording its first freshness marker. For later activity, an `active → idle` transition is only a cue to await `awaitInSync()`; idle alone is not a freshness proof because a failed/retrying cycle can become inactive before it has converged. Pull handlers are never allowed to stamp freshness because returned rows/checkpoints may not yet be committed locally.
- **Stale-client recovery is read-only:** if a collection's trusted freshness is older than 90 days, the coordinator performs one owner-scoped full remote pull before starting that pilot. The recovery may update/tombstone local rows but must never call Appwrite `updateRow`/`createRow`. Local rows newer than the trusted application timestamp boundary are preserved; invalid/unknown timestamps are preserved conservatively; pending outgoing messages are never tombstoned merely because they are absent remotely.
- **No-assumed-master first sync is semantic, not LWT-based:** for tasks/categories/diary/settings, `row.assumedMasterState === undefined` means first sync or lost replication metadata. A local row equal to the current remote is acknowledged with no write; a newer remote wins; only a genuinely newer local application `updatedAt` may update an existing remote row; a truly missing remote row may be created. Task bootstrap writes preserve current server-owned reactions. RxDB `_meta.lwt` alone must never classify a row as a user edit because downstream replication also advances it.
- **Shared RxDB rows are owner-scoped at the replication boundary:** Mosaic deliberately keeps multiple accounts' local rows in the same physical RxDB so account switching and account-scoped erasure do not destroy unrelated offline data. A per-user RxDB replication identifier may therefore encounter local rows whose `userId` belongs to another account during its upstream scan. Every pilot must acknowledge/ignore those foreign local rows without reading or writing Appwrite; treating them as an owner-mismatch error can poison that user's replication queue forever. This exception applies only to local rows outside the active replication scope. Owner-scoped Appwrite steady-state pulls, stale-recovery/bootstrap snapshot reads, and direct master reads are validated before mapping; if Appwrite returns a remote/master row for a different owner, replication fails closed as a real cross-account collision instead of silently filtering or accepting it.
- **Pilot lifecycle is serialized:** each replication pilot serializes start/stop transitions through a small lifecycle queue. A new owner cannot start in the cancellation gap of a previous owner and leave an orphaned replication. If the coordinator detects a stale auth generation, it stops any pilot belonging to that old owner before exiting.
- **Durable retry queues are per-entry:** generic message/social retry outboxes store one localStorage record per `(userId, dedupKey)` instead of rewriting one whole JSON array. This prevents one tab's stale queue snapshot from deleting another tab's newly-enqueued intent. Flushes use an owner-scoped Web Lock when available, compare the stored entry before remove/update, keep queue caps per account, and stop between entries when the captured auth generation expires.
- **Realtime is a wake-up signal, not a durable checkpoint source:** Appwrite Realtime create/update callbacks emit RxDB `RESYNC` rather than injecting a checkpointed document. Provider sockets can reconnect after missed or reordered events; allowing one later Realtime payload to advance the durable `$updatedAt + $id` checkpoint could skip an unseen change. Ordered owner-scoped pull handlers remain the only source of checkpoint advancement. Friendship/message hard-delete callbacks may still apply their immediate local soft-delete side effect before requesting `RESYNC`.
- **Local changes are observed by RxDB pilots, but remote-write ownership remains domain-specific:** task/category/diary/settings owner writes are pushed by their pilots; friendship upstream is validation-only and friendship commands remain transactional `message-action` operations; message upstream is validation-only and delivery/read/unsend/reaction intent remains owned by `deliverPendingMessages`, `messageActionQueue`, and `message-action`.
- **Manual Sync Now is a freshness + anti-entropy barrier:** the Sync Status sheet first requests/awaits all six pilots so pending owner writes and collection-specific conflicts are settled. It then runs one bounded owner-scoped full reconciliation before awaiting all six pilots a second time and only then records successful `lastSync`. This repairs a local replica whose durable pull checkpoint has advanced past an older divergent row, including same-application-timestamp drift that ordinary incremental replication cannot rediscover. Tasks/categories/diary/settings and the friendship cache accept the server snapshot as authoritative after that first barrier unless the local row changes during reconciliation; messages remain conservative so newer Function/outbox intent and pending outgoing rows are preserved. Equal owner rows are not rewritten. Incomplete/page-failed reconciliation fails closed. Ordinary focus/visibility/reconnect/watchdog triggers remain non-blocking incremental `forceSync()` calls, and ChatPage's 30-second heartbeat still nudges messages only.
- **Diary tombstones carry deletion time:** deleting a diary entry sets both `isDeleted: true` and a fresh `updatedAt`. Tombstone retention/GC must never inherit the entry's pre-deletion edit timestamp.
- **Bounded loops:** any externally re-enterable loop has an iteration cap. `deliverPendingMessages` caps at 5 and logs `[messageDelivery] delivery loop hit cap (5); breaking`; remaining rows stay pending until the next trigger. Delivery also re-checks the authenticated owner generation before each query/send/local delivery-status patch, so a session switch cannot continue an old owner's loop under the new session.
- **Attempt-once ref:** lazy side effects that should run once per entity (friend bio backfill) use a `useRef<Set<string>>` of attempted IDs.
- **Fire-and-forget cross-user writes:** `mark_read`, `unsend`, `react`, `react_to_task` are dispatched without awaiting. Errors log but never throw. `mark_read`/`unsend` enqueue into `messageActionQueue` on transient failure; `react`/`react_to_task` do not (they have optimistic-revert + user feedback; silent retry would desync). `deliver` retries via the pending outbox.
- **Polling in long-lived chat:** Appwrite Realtime is the primary message update path. `ChatPage` retains a 30s visible/online safety heartbeat, but it calls `forceMessageSync()` so only the message pilot is resynced once active; if the pilot is not active yet, the coordinator starts the normal RxDB path. Cleared on unmount.
- **Auto-scroll pinning:** chat lists track following intent synchronously in `useChatScroll`. Incoming auto-scrolls only when pinned (8px tolerance); newly added outgoing messages always scroll. Resize callbacks re-check intent before maintaining a pin.
- **`queueMicrotask` for effect-triggered async:** wrap the kickoff in `queueMicrotask(() => { ... })` and re-check `isMountedRef.current` inside; the async function itself must be async-first (all setState after the first `await`).
- **Conflict semantics stay collection-specific:** owner-write pilots compare assumed/current master state and apply the no-assumed first-sync rule above; friendships validate against the server master; messages preserve only explicitly known local Function/outbox intents while pulling remote state.
- **Two-phase read-then-write for multi-row server mutations:** when an Appwrite Function writes to >1 row in one action (`handleReact`), structure as two passes. **Pass A** reads + computes next values for every target, validating each (`REACTIONS_MAX_LEN` overflow check). **Pass B** writes. Any Pass A validation failure returns 400/403 before ANY write — prevents one-row-succeeded / one-row-overflowed partial commits. Residual risk: a Pass B failure after the first write partially commits; next sync reconciles. Known limitation (§20.7).
- **Mounted pane freshness:** any component displaying cached data from an externally-changeable source that stays mounted across navigation MUST refetch on activation, throttled by a minimum interval. Reference: `PersonPane` friend-pane activation (`FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`). Own-user panes are exempt if they subscribe live via RxDB. Do not rely on cache TTL alone.

### Category RxDB replication pilot

Categories are the first collection delegated to RxDB's generic replication protocol. This is deliberately incremental rather than a sync rewrite.

- Normal startup starts/resumes the category pilot directly with `mosaic-appwrite-tablesdb-categories-v1:<userId>`; there is no per-session legacy writer before handoff.
- If RxDB has no assumed master for an existing category, equal local/remote state is acknowledged without an Appwrite write, a newer remote wins, and only a genuinely newer local application `updatedAt` may update the existing row. A truly missing remote category still uses strict `createRow`.
- If the category's local replication freshness is older than 90 days, the coordinator first performs the shared read-only full stale recovery. Incomplete pagination or row failures block pilot start; recovery never writes Appwrite.
- Remote pull checkpoints are server-authored Appwrite `$updatedAt + $id` tuples ordered by the same fields and scoped by `user_id`. This removes client-clock overlap from the pilot's steady-state pull path.
- Mosaic's `isDeleted` remains an ordinary replicated soft tombstone. RxDB's internal `_deleted` flag remains false for category rows; the pilot must never translate a Mosaic soft delete into an RxDB physical deletion.
- Appwrite Realtime for categories is owned by the pilot's pull stream. No shared legacy realtime module remains. Focus/reconnect/background triggers call the pilot's `reSync()` directly after handoff.
- Existing rows still use `updateRow`; missing/new rows use strict `createRow`; `upsertRow` remains forbidden. Push compares the current remote category with RxDB's assumed master state before updating, but Appwrite still lacks an atomic compare-and-update, so the accepted concurrent-write race remains.
- The pilot does not gate initial UI/database readiness. Safety-sensitive `refreshSync()` awaits this pilot only in the RxDB leader tab and fails closed if another tab owns leadership; ordinary manual/background resync remains non-blocking. Its status/error presentation remains experimental until the pilot is accepted for broader rollout.

### Diary RxDB replication pilot

Diary is the second collection delegated to the same generic RxDB replication protocol after the category pilot proved stable in hosted use.

- Normal startup starts/resumes the diary pilot directly under its stable versioned replication identifier. With no assumed master, equal state is acknowledged without a write, a newer remote wins, and only a genuinely newer local `updatedAt` may update an existing row. A >90-day freshness boundary triggers read-only full stale recovery before pilot start.
- Steady-state diary pulls use owner-scoped Appwrite server `$updatedAt + $id` tuple checkpoints. Mosaic `isDeleted` remains the replicated soft tombstone and RxDB `_deleted` remains false.
- The diary pilot owns diary Appwrite Realtime after handoff; no shared legacy realtime module remains. Focus/reconnect/background triggers call the pilot's `reSync()` rather than running the compatibility pull/push loop.
- Diary create/update/delete local writes are observed directly by RxDB. The old hook-level delayed legacy sync trigger is intentionally removed for diary so one diary edit does not wake the entire remaining legacy engine.
- Existing remote rows use `updateRow`; missing/new rows and update-404 fallback use strict `createRow`. Push compares the current remote diary state with RxDB's assumed master state before update; Appwrite's existing non-atomic compare/update race remains an accepted limitation.
- The fresh diary deletion timestamp contract above remains required: the tombstone's `updatedAt` is the deletion time used by retention/GC, not the entry's prior edit time.
- Safety-sensitive `refreshSync()` awaits diary `awaitInSync()` in the RxDB leader tab. If another tab owns leadership, restore/import fails closed instead of proceeding from a possibly stale diary snapshot.

### Settings RxDB replication pilot

Settings are the third collection delegated to generic RxDB replication. They use the same clean-bootstrap handoff as categories and diary, with an additional Storage/profile side-effect contract.

- Normal startup starts/resumes the settings pilot directly under its stable versioned replication identifier. With no assumed master, equal state is acknowledged without a write, a newer remote wins, and only a genuinely newer local `updatedAt` may update an existing row. A >90-day freshness boundary triggers read-only full stale recovery before pilot start.
- Steady-state pulls use owner-scoped Appwrite server `$updatedAt + $id` tuple checkpoints. A read-only production probe confirmed that exact query shape is accepted by the current settings table; the table currently has no custom indexes.
- The settings pilot owns settings Appwrite Realtime and local change detection after handoff. No shared legacy realtime module remains, and `useSettings` does not schedule a legacy mutation-sync trigger.
- Existing rows use `updateRow`; missing/new rows and update-404 fallback use strict `createRow`. Push compares the current remote setting with RxDB's assumed master state before update; Appwrite's non-atomic compare/update race remains an accepted limitation.
- `profileImageId` preserves Mosaic's offline media workflow. A pending profile image is uploaded and made readable before the setting row is written. The profile avatar side effect must succeed before the pending blob is removed. If the setting reached Appwrite but the profile write failed, the pending blob remains available and the next reconciliation repairs the profile from the authoritative remote setting. If the server wins a conflict, the now-obsolete pending blob is removed.
- Mosaic `isDeleted` remains a soft tombstone and RxDB `_deleted` remains false. Safety-sensitive `refreshSync()` awaits settings `awaitInSync()` in the RxDB leader tab alongside category and diary; another-tab leadership fails restore/import closed rather than accepting stale settings.

### Friendship RxDB replication pilot

Friendships are the fourth collection delegated to generic RxDB replication, but unlike categories/diary/settings the Appwrite table is server-owned. The browser never writes friendship rows directly.

- Normal startup starts/resumes the friendship pilot directly. Friendship upstream remains validation-only. Only when the local friendship freshness proof is older than 90 days does the coordinator run the existing bounded full server-owned-cache repair before pilot start; that recovery replaces stale optimistic rows, tombstones clean local rows missing from the complete remote snapshot, preserves newer Function/realtime results that race the pull, and never writes friendship rows to Appwrite.
- Steady-state pulls use owner-scoped Appwrite server `$updatedAt + $id` tuple checkpoints. A read-only production probe confirmed this exact query shape against the current friendships table; the table already has available indexes for `user_id`, `user_id + status`, and `friend_id`.
- The RxDB upstream is **validation-only**. It never calls `updateRow` or `createRow` for friendships. A local state equal to the server is acknowledged; a divergent local state resolves to the current remote master. A local row whose master no longer exists resolves to a Mosaic soft tombstone. Local friend-bio cache enrichment may be acknowledged without mutating the master.
- Physical local deletion is not permission to delete a friendship remotely. If a valid server row still exists, replication restores it as the master conflict. The only physical deletions acknowledged without a server lookup are the known invalid legacy local friendship IDs that `FriendsProvider` already purges.
- Friendship mutations remain owned by the durable command queue + `message-action` Function. Send/accept/decline/cancel/remove/block continue to use expected-version transactional commands; confirmed Function responses may update the local RxDB cache immediately and the validation-only upstream then acknowledges/reconciles them.
- The pilot owns friendship Appwrite Realtime after handoff. Create/update events enter the RxDB pull stream; a hard-delete event soft-deletes the matching owner-scoped local cache row, clears the cached friend calendar, and requests a resync. No shared legacy realtime reconciliation path remains.
- Blocked/deleted remote rows clear cached friend calendars on pull/realtime/validation. Mosaic `isDeleted` remains the ordinary soft tombstone and RxDB `_deleted` remains reserved for local storage mechanics.
- Safety-sensitive `refreshSync()` awaits friendship `awaitInSync()` in the RxDB leader tab alongside category, diary, and settings. Another-tab leadership continues to fail restore/import closed instead of accepting a stale relationship graph.

### Task RxDB replication pilot

Tasks are the fifth collection delegated to generic RxDB replication. This handoff preserves the task-specific Storage and cross-user reaction contracts instead of treating tasks like a plain category row.

- Normal startup starts/resumes the task pilot directly under its stable versioned replication identifier. With no assumed master, equal task state is acknowledged without a write, a newer remote owner state wins, and only a genuinely newer local `updatedAt` may update an existing row; current server reactions are merged into that bootstrap write. A >90-day freshness boundary triggers read-only full stale recovery before pilot start.
- Steady-state task pulls use owner-scoped Appwrite server `$updatedAt + $id` tuple checkpoints. A read-only production probe confirmed this exact query shape against the current tasks table; the table currently has no custom indexes.
- The task pilot owns task Appwrite Realtime and local change detection after handoff. `useTasks` CRUD/completion/reorder writes are observed directly by RxDB and do not wake the compatibility bootstrap through a delayed mutation timer.
- Existing remote rows use `updateRow`; missing/new rows and update-404 fallback use strict `createRow` with owner read/update/delete row permissions. Mosaic `isDeleted` remains a soft tombstone and RxDB `_deleted` is never used as the task-delete representation.
- Offline task images preserve the pending-image workflow. A pending image is uploaded before the task row references it; the pending blob is removed only after the task row write succeeds. If the row write fails, the pending blob remains available for retry. A pending image on a soft-deleted task is cleared from the tombstone without uploading. If the server wins a conflict, an obsolete pending blob is cleaned locally.
- **Task reactions are server-mutated state.** Friends change `reactions` through `message-action/react_to_task`, which also advances remote `updated_at`. When RxDB pushes an owner task edit and the current master differs from its assumed master only in `reactions + updatedAt`, the adapter merges the current server reaction string into the owner edit and carries the later timestamp rather than overwriting the reaction. A change to any owner-controlled task field remains a normal master conflict. Appwrite still lacks an atomic compare-and-update, so a reaction landing after the adapter reads the master but before `updateRow` remains part of the accepted concurrent-write race.
- Realtime reaction updates enter the task pull stream, so the owner's local task chips update through the same replication path as ordinary remote task changes rather than a duplicate legacy handler.
- Safety-sensitive `refreshSync()` awaits task `awaitInSync()` in the RxDB leader tab alongside category, diary, settings, and friendships. Another-tab leadership continues to fail restore/import closed rather than claiming a fresh task snapshot.

### Message RxDB replication pilot

Messages are the sixth and final synced collection delegated to generic RxDB replication. Unlike owner-write collections, message rows remain **Function/outbox-owned**: replication never creates or updates a message row directly.

- Normal startup starts/resumes the message pilot directly under its stable versioned replication identifier. Existing RxDB metadata resumes the stored server tuple checkpoint; if metadata is absent, RxDB performs its normal initial history reconciliation and the validation-only upstream never browser-writes message rows.
- Pull/realtime merge rules protect pending delivery/read/unsend/reaction intent during that first reconciliation. A >90-day local freshness boundary triggers the shared read-only full stale recovery before pilot start; pending outgoing messages missing remotely are preserved.
- Steady-state pulls use owner-scoped server `$updatedAt + $id` tuple checkpoints. Read-only production probes confirmed both the ascending tuple query and the descending one-row tail query against the current messages table; existing message indexes remain unchanged.
- The message RxDB upstream is **validation-only**. It validates owner scope and rejects RxDB physical deletion, but returns successful acknowledgement without browser row writes. Delivery stays in `deliverPendingMessages`; transient `mark_read` and `unsend` retries stay in `messageActionQueue`; message reactions and all peer-row writes stay in `message-action`; Delete All Data retains its explicit remote tombstone path.
- Pull/realtime reconciliation preserves only known local intents that may legitimately precede their Function result: newer local unsend state, optimistic reactions, reply-snapshot wipe from unsend cascade, legacy `originalMessageId` backfill, incoming local read state while `mark_read` is pending, and local soft tombstones. Outgoing `readAt` remains server-owned even when another local intent is preserved. A newer remote mutation wins over older optimistic state.
- The pilot owns message Appwrite Realtime. Create/update events are merged through the same local-intent rules before entering the RxDB pull stream; hard deletes become owner-scoped local soft tombstones plus a resync request. All six pilots now own their own realtime streams; the shared legacy realtime module and AppLayout lifecycle shell have been removed.
- Appwrite Realtime is the primary read-receipt/reaction/unsend propagation path. ChatPage keeps its 30-second safety heartbeat but calls `forceMessageSync()`, which resyncs only messages after handoff instead of waking every collection.
- Safety-sensitive `refreshSync()` awaits message `awaitInSync()` alongside the other five pilots. Another-tab leadership continues to fail restore/import closed instead of accepting stale chat state.

### Accepted Sync Engine Limitations

These are documented, deliberate trade-offs after the sync-engine audit. Each was considered for a fix and rejected. Do not "fix" them without revisiting the reasoning below and the risk profile that produced the decision.

- **D1 — closed by owner-write compare-and-set once the backend action is active.** Category, diary, settings, and task adapters still perform their collection-specific semantic master checks, but the final owner update is routed through the trusted `message-action` Function. The Function applies server-side `updateRows` constrained by row `$id`, the server-authored `$updatedAt` observed by the client, and `user_id`; a stale token updates zero rows and returns the current master to RxDB instead of overwriting it. A 2026-10-06 disposable-project concurrency proof produced one winner/one zero-row loser for simultaneous writers. No `sync_rev` schema column is required. The client falls back to the historical direct `updateRow` only when an older deployed Function reports the CAS action as unknown, so staggered Preview rollout remains usable; that fallback is not accepted final production behavior.
- **Stale-recovery clock boundary:** the rare >90-day recovery must distinguish possible local edits from clean cache without relying on RxDB `_meta.lwt`, because downstream replication also advances LWT. Mosaic therefore uses application `updatedAt` against the last trusted freshness boundary, preserves invalid/unknown timestamps conservatively, and lets normal RxDB conflict handling resume afterward. Revisit if Mosaic needs a server-issued per-device acknowledgement protocol or stronger guarantees under severely skewed client clocks.
- **Friendship consistency:** both rows change atomically through `message-action` transactions. Browser permissions are owner-read only and the RxDB friendship upstream is validation-only, never a row writer. Normal startup resumes RxDB directly; a bounded full friendship repair runs only when the local freshness proof exceeds the tombstone horizon. Function responses and pilot realtime remain owner/version guarded. Send/accept/decline/cancel/remove/block use explicit state transitions and the caller's observed `updated_at` version. A stale command cannot overwrite a later transition. See [friendship rollout and recovery](FRIENDSHIP_RECOVERY.md).

## 19. Bootstrap & Persistence
1. React mounts immediately. `navigator.storage.persist()`, local database opening, service-worker registration, analytics initialization, and image-cache maintenance are non-blocking background/bootstrap work and must never delay the Login route's first render.
2. `src/lib/databaseBootstrap.ts` owns the single local-database readiness promise. It dynamically imports RxDB/database code so the logged-out Login startup graph does not eagerly parse the database stack. Protected routes cross one database-readiness boundary before any RxDB-backed provider or hook mounts; do not scatter retry loops around individual `getDatabase()` consumers.
3. Auth resolution happens only in `AuthProvider`. Replication/bootstrap code never calls `account.get()` to discover identity; it receives the already-resolved owner id explicitly, preserving AuthProvider as the sole session authority and avoiding duplicate cold-start auth requests.
4. A valid last-known identity is the immediate local startup authority regardless of the browser's network hint. AuthProvider renders that account's local app immediately and verifies the live Appwrite session in the background. Confirmed 401 clears the cache; network failure keeps the local identity. Auth/login/logout/broadcast results use generation/race guards so an older async session check cannot overwrite a newer auth action. AuthProvider also establishes the lightweight authenticated-work generation synchronously from cached identity before child effects run, and invalidates/suspends old sync work before session-changing login/signup/logout operations.
5. Authenticated Home startup overlaps three independent activities: cached/live auth resolution, local database opening, and Home chunk acquisition. When a last-known identity is already cached, the database and Home dynamic imports are kicked off in the bootstrap task before the React mount call so their network/module work overlaps the initial React commit; this remains asynchronous and does not apply to a genuinely logged-out Login. Online RxDB replication starts only after auth + database readiness and never gates Home rendering from already-local data.
6. The local-only `syncMeta` tracker marks each collection fresh only after RxDB reaches a settled in-sync state. Once all six current replication identifiers have a freshness record, that account's **data offline-ready** milestone is marked. Service-worker precache installation marks the device's **shell offline-ready** milestone. The account/device is considered offline-ready only when both exist. This readiness is informative and non-blocking: first-login Home remains responsive while offline preparation finishes.
7. `ignoreDuplicate: true` on `createRxDatabase` + a singleton `dbInstance` module variable remain required for React StrictMode double-invocations. Data hooks continue to scope every query by owner and may purge known-bad legacy rows during initialization.
8. Startup performance marks are diagnostic, not CI budgets. The startup probe records database module import, database creation, collection setup, AppDataShell mount, owner task/category readiness, carousel readiness, and full local-data readiness so optimization work can distinguish first paint from usable owner data. The durable acceptance invariant is behavioral: logged-out Login renders without waiting for RxDB/Appwrite; an offline-ready authenticated account can cold-reload Home from cached identity + local data without a network-dependent full-screen spinner.
9. The initial owner Home graph must exclude interaction surfaces that are not needed for the first usable calendar. Closed Day View instances and category/friend settings sheets do not mount until first use; Todo List and friend-person code are dynamically loaded outside the initial owner-calendar graph. The existing idle person render window remains the boundary that can begin loading adjacent friend panes after the first Home commit.
10. Legacy oversized settings-row repair is shared across concurrent `useSettings()` consumers with one in-flight/completed cleanup promise per account for the current JavaScript session. A failed cleanup clears that memoized promise so a later subscription may retry; normal settings subscriptions remain independently owner-scoped.

## 20. Messaging Architecture

### 20.1 The Two-Row Pattern
Every 1:1 message exists as **two independent Appwrite rows**, one per participant:

| Row | `user_id` | `direction` | Row ID |
|---|---|---|---|
| Sender's copy | sender | `outgoing` | `msg_<random>` (client-generated, `useMessages.ts`) |
| Recipient's copy | recipient | `incoming` | `rmsg_<sha256(senderMsgId).slice(0,30)>` (deterministic, `makeRecipientRowId`) |

Both rows share `thread_id`, `sender_id`, `recipient_id`, `created_at`, and content. The recipient row id is deterministic so the sender's client can compute it without a server round-trip. `original_message_id` on the incoming row stores the sender's `msg_*` id so the recipient can locate the peer row for reactions.

### 20.2 Why Two Rows
- Preserves the sync engine's single-owner invariant: every row a user syncs is owned by that user
- Row-level permissions stay simple: `[read(owner), update(owner), delete(owner)]` on every row
- Read receipts work naturally: recipient patches their own incoming rows; server patches sender's outgoing rows via API key
- No RLS gymnastics for cross-user visibility

### 20.3 The `message-action` Appwrite Function
Single function, single ID, `action` field in the body. Actions:

| Action | Caller | Purpose |
|---|---|---|
| `friendship` | authenticated participant | Transactional send/accept/decline/cancel/remove/block; caller identity comes from Appwrite execution headers, profile snapshots from stored profiles |
| `delete_account_friendships` | deleting account owner | Hide profile and tombstone all reciprocal relationships, including remote-only/blocked rows, before local queues can be cleared |
| `deliver` | sender | Create the recipient's row via API key with recipient-owned permissions. Rejects `messageId` not starting with `msg_`, and messages with no content, no task ref, and no reply target (`Message has no content`) |
| `mark_read` | recipient | Patch `read_at` on sender's outgoing rows (`WHERE user_id = sender AND thread_id = X AND direction = 'outgoing' AND read_at = ''`). Response: `{ ok: true, markedPartner, markedCaller }` |
| `unsend` | sender | Patch BOTH rows: wipe content/refs/reactions, set `is_unsent=true`. Cascade-wipes `reply_to_content` on any messages that quoted the unsent message |
| `react` | either | Read-modify-write reactions on BOTH rows using two-phase read-then-write (overflow pre-check on both rows before any write — see §18 and §20.7). Legacy incoming-row backfill: see §22 |
| `react_to_task` | friend of task owner | Patch the task owner's task row with a reaction delta |
| `bulk_create_todomate_tasks` | authenticated owner | Migration-only fast path for a pristine TodoMate RxDB push batch (max 20): validate every row, force caller ownership/TodoMate source/non-deleted/no-reaction state, create rows concurrently with API-key server calls and owner-only permissions, and return same-owner 409 rows for normal client conflict resolution |
| `get_friend_calendar` | friend of calendar owner | Read the owner's visible tasks and categories (filters by `visibility`; verifies friendship) |
| `get_notifications` | authenticated recipient | Read the caller's friend-completion feed after live friendship/task/visibility revalidation |
| `mark_notifications_read` | authenticated recipient | Mark only caller-owned notification rows read |
| `get_push_config` | authenticated user | Return whether Web Push is configured and expose only the VAPID public key |
| `register_push_subscription` | authenticated user | Register/update one HTTPS Web Push endpoint for the caller |
| `unregister_push_subscription` | authenticated user | Remove the caller's matching Web Push endpoint |

The same Function also receives Appwrite TablesDB `tasks` row create/update events. Eligible task-completion events fan out deterministic server-only `notifications` rows to mutual friends and optionally send Web Push; repeated events for the same recipient/task/completion are idempotent.

Function ID is shared by `src/lib/appAction.ts` and the message layer; `src/lib/messageDelivery.ts` still exports `MESSAGE_ACTION_FUNCTION_ID` for compatibility. Actions dispatch from `appwrite-functions/message-action/main.js`, with larger action handlers split into sibling modules. Accepted friendship is verified before message/calendar writes; friendship lifecycle actions validate their own transition and caller authorization. (General cross-user-write rule: §6.)

### 20.4 Delivery Flow
1. Sender inserts local message with `deliveryStatus: 'pending'`
2. `deliverPendingMessages(userId)` scans for pending outgoing rows
3. Each is sent to `message-action` with `action: 'deliver'`
4. On success: local row patched to `deliveryStatus: 'delivered'`
5. Re-entrancy is scoped by the authenticated owner generation; same-owner triggers coalesce, a newer owner waits for the previous generation to retire, and the outer loop remains capped at 5 iterations (§18)
6. Triggered on `AppLayout` mount, `window.focus`, `window.online`, and after every send
7. Each trigger also best-effort flushes the `messageActionQueue` (§20.5)

### 20.5 Read Receipt & Unsend Retry Flow
1. Recipient opens `ChatPage`, patches their incoming rows' `readAt` locally (drives unread badge)
2. Calls `markReadOnRemote(userId, partnerId, threadId)` → server patches sender's outgoing rows
3. On transient failure (429, 5xx, network), `markReadOnRemote` enqueues a `mark_read` entry into `messageActionQueue` (dedup key `mark_read:${threadId}`). On success or permanent failure, no entry is enqueued
4. Appwrite Realtime normally delivers the server update immediately; ChatPage's 30-second `forceMessageSync()` heartbeat is the bounded catch-up path if a realtime event is missed
5. `MessageBubble` renders "✓✓ Seen at [time]" under the last read outgoing message

The generic retry queue uses per-entry account-scoped localStorage records rather than one shared array. The legacy array format is migrated on read. Flush is serialized across tabs with an owner-scoped Web Lock where available and compare-before-remove semantics preserve any newer same-key enqueue that races an older send. Retry queue capacity is 100 entries **per account**, so one account cannot evict another account's intents on a shared browser.

Unsend follows the same pattern: `unsendOnRemote(userId, messageId, recipientId)` enqueues on transient failure (dedup key `unsend:${messageId}`). Both entries are retried by `flushMessageActionQueue`, which runs on every `deliverPendingMessages` trigger. Attempts cap at 5; on exhaustion the entry is dropped and a warning logged.

Realtime is now the primary propagation path for read receipts, reactions, unsend, and incoming delivery. The 30-second ChatPage heartbeat remains as a message-only `reSync()` safety net for missed/stalled realtime; it no longer wakes the whole sync coordinator once the message pilot is active.

Recipient-side `read_at` propagation depends on `markReadOnRemote` eventually succeeding — synchronously or via the queue. If both the initial call and every retry fail, the local patch applies but the server never learns, and the badge reappears for that thread on a fresh login or second device. The queue closes the previously-silent gap where a single failed attempt left state permanently divergent; residual risk is bounded to 5 attempts.

### 20.6 Unsend Cascade
`unsend` wipes content on both rows AND cascades to any message whose `reply_to_id` matches either the sender's `msg_*` or the recipient's `rmsg_<hash>` id. Quotes of an unsent message render as "Message deleted" on both sides. The client also cascades locally in `useMessages.unsendMessage` for immediate feedback. If the remote `unsend` fails permanently (5 attempts exhausted), the sender's local state is unsent but the recipient never learns — a known limitation of the retry-bounded approach.

### 20.7 Message Reactions
`action: 'react'` reads both the caller's row and the peer's row, applies a delta via `applyReactionDelta`, and writes both back. The peer row id is derived locally:
- Outgoing message: `makeRecipientRowId(doc.id)`
- Incoming message: `doc.originalMessageId` (or server lookup if empty)

**Two-phase write (CRITICAL):** the server uses Pass A / Pass B (§18). Pass A reads both rows, applies `applyReactionDelta` to each, and validates both against `REACTIONS_MAX_LEN`. If either would overflow, the function returns HTTP 400 **before writing anything**. Pass B then writes both. Residual risk: if the second Pass B write fails after the first succeeded, the pair is partially committed; the next sync cycle reconciles. Rollback was rejected — a third write introduces its own failure modes. Known limitation, not a bug.

### 20.8 Task Reactions
`action: 'react_to_task'` patches the task owner's task row. Caller must be an accepted friend of the owner. Only `add` operations fire a chat message. Uses the same `reactionUtils` helpers as message reactions.

## 21. Chat UI Conventions
- **Gesture direction is role-relative:** incoming bubbles swipe right; outgoing swipe left. Both reveal a reply icon on the uncovered side.
- **Timestamp reservation:** bubble status rows (`Delivered`, `Seen at`, timestamp) always occupy their minimum height; visibility toggles via `opacity`, never presence. Specific fix for the hover-flicker loop.
- **Auto-scroll pinning:** `useChatScroll` resets following intent for each account/conversation and initializes after loading. Incoming additions scroll only when already pinned (8px tolerance); outgoing additions always scroll. Edits, receipts, and deletions do not resume following. Resize callbacks re-check intent at execution; scrolling upward or following a quote suspends it. Returning to the bottom or using the FAB resumes it.
- **Scroll-to-bottom FAB:** appears when scrolled >8px from bottom and stays above the composer. Green dot indicates unacknowledged messages below. Hidden during search.
- **Search:** local-only, no server round-trip. `Cmd/Ctrl+F` or `Cmd/Ctrl+K` opens; `Esc` or X closes. Filters bubble content, task refs, reply quotes. Match counter `N/M`. Date dividers and gap-timestamps hidden while searching. Auto-scroll on new messages suppressed during search. Closing search restores the prior visible-message anchor and following intent; sending closes search and follows the outgoing message.
- **Chat geometry:** chat detail bypasses the five-page primary-route sequence and bottom nav, but may use the shared full-height left-edge Back drag wrapper; inside it, chat still has one bounded message scroller. Header and composer are non-shrinking siblings; composer and FAB share a dock. `useChatViewport` applies normal-zoom VisualViewport height/offset once at the layout boundary, with dynamic viewport height as fallback. Content-width preferences and safe-area padding remain active.
- **Initial composer focus:** entering/opening a chat leaves the message textarea unfocused so a phone keyboard is not summoned automatically. Keyboard focus begins only after explicit composer interaction or a reply action that intentionally focuses the composer.
- **Reply focus:** swipe-to-reply sets the composer's reply context and calls `composerRef.current.focus()` after 50ms (lets the reply-strip render first).
- **Composer send focus:** tapping Send while the textarea is focused must not transfer focus to the Send button. The textarea remains focused after send so the mobile keyboard stays open and the composer stays above the keyboard in the resized viewport.
- **Long-press vs swipe:** movement >8px cancels the long-press timer; movement >30px vertical aborts the swipe and hands off to native scroll (`touch-action: pan-y`).
- **Double-tap ❤️:** fixed emoji, no config. Uses `toggleReaction`.
- **Overlay safety:** when any sheet is open, `gesturesDisabled` is passed to every bubble so swipes don't fire behind the sheet.
- **Unsent bubbles:** all gestures disabled. No reply icon, no action sheet, no double-tap react. Status row still renders for timeline coherence.
- **Reaction timeout toast:** `toggleReaction` returns `'ok' | 'timeout'`. When a reaction is applied optimistically to an outgoing message that stays `deliveryStatus: 'pending'` past the 5s delivery wait, the optimistic patch is reverted and the mutator returns `'timeout'`. All three `ChatPage` reaction call sites (`handleBubbleReact`, `handleReactFromSheet`, `handleEmojiPicked`) branch on this and show the existing toast pattern with the string `"Couldn't send reaction. Try again."`. Do not add new toast infrastructure — reuse the page-level `feedback` state that auto-dismisses after 2000ms.

## 22. Task Reactions
- **Storage:** `task.reactions` (exists in `TaskDocument` and `tasksSchema`). Format: JSON array of `{emoji, userIds}`. Parse/stringify via `src/lib/reactionUtils.ts`.
- **UI:** Heart button beside the reply button in `FriendDayViewSheet`. Tapping opens `EmojiPickerSheet`. Picking calls `useFriendCalendar.reactToTask(task.id, emoji)` and, on `add`, `useMessages.sendTaskReaction(task, emoji, color)`.
- **Chat notification:** emoji sent as a chat message with a `TaskRefCard`, identical to a task reply. Only on `add` — removes are silent.
- **Chip display:** reaction chips render below the task title in both `FriendDayViewSheet` (interactive) and the owner's `DayViewSheet` → `TaskItem` (display-only, `onToggle` is a no-op).
- **Optimistic update:** `useFriendCalendar.reactToTask` patches local state first, calls the server, reverts on failure. `patchCachedCalendarTask` persists the server-confirmed value to the friend cache.
- **No self-reactions:** server rejects `callerId === taskOwnerId` with 400.
- **Owner viewing chips:** owners see chips on their own tasks in `DayViewSheet` but cannot toggle them (would need an `remove` op from the owner's side; not implemented).
- **Legacy messages:** message reactions on incoming rows require `originalMessageId`. If empty (pre-V2.4 rows), the server resolves it via `resolveLegacyPeerRowId` on `(sender_id, created_at, content)`. The client persists the resolved id locally so subsequent reactions don't need a lookup.

## 23. Auth Architecture

### 23.1 The Provider
- `AuthProvider` (in `src/hooks/AuthProvider.tsx`) is the **single source of truth** for session state. It owns the only `account.get()` call that runs on mount
- `AuthContext` (in `src/hooks/authContext.ts`) holds the context object and the `AuthContextValue` type. It exports no component, keeping `AuthProvider.tsx` fast-refresh-clean
- `useAuth` (in `src/hooks/useAuth.ts`) is a thin consumer that returns `AuthContextValue` or throws if called outside the provider
- `AuthProvider` is wired in `main.tsx` inside `<React.StrictMode>` and wraps `<App />`

### 23.2 The `AuthContextValue` Shape
```ts
{
  user: Models.User<Models.Preferences> | null;
  isLoading: boolean;
  error: string | null;
  isOffline: boolean;           // true = "couldn't check", not "logged out"
  pendingSignup: { email: string; name: string } | null;
  login: (email, password) => Promise<boolean>;
  signup: (email, password, name, username) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updateEmail: (newEmail, password) => Promise<boolean>;
  updatePassword: (newPassword, oldPassword) => Promise<boolean>;
  retry: () => Promise<void>;
}
```

### 23.3 Session Transitions
- **Mount:** `AuthProvider` defers `account.get()` via `queueMicrotask` inside its mount effect. On 401 → `user: null`, `isOffline: false`. On network error → `user: null`, `isOffline: true`, error message set
- **Login:** clears any stale session, creates a new one, calls `account.get()`, clears stale local signup-recovery state, and publishes authenticated app state. New signups create their required username/profile before first entry, while legacy accounts that predate that requirement remain usable; existing social surfaces still prompt for profile setup when needed.
- **Signup:** collects display name + username before account creation. A small `mosaic_pending_signup` record lets the flow survive reloads and ambiguous account-creation responses. Account-create 409 is not assumed to be success: Mosaic must prove ownership by creating the email/password session. If Appwrite reports an already-active session, Mosaic reuses it only after `account.get()` proves the session belongs to the submitted email. If that live session belongs to another account, Mosaic retries clearing it and establishing the requested account; if the stale session cannot be cleared, the attempt fails closed and must never publish the other account. The profile/username is created before the user is cached/published; the remote unique username constraint is authoritative, so a profile 409 keeps the account in resumable setup. Only completed account + profile onboarding broadcasts `login` and starts ordinary post-auth sync.
- **Logout:** deletes the session, updates state, broadcasts a `logout` event. Returns `true` on success and `false` on failure. **Callers must gate navigation on the return value**
- **Update email / password:** these do not change session identity; they refresh `user` only

### 23.4 Mid-Session 401 Handling
- Every SDK call that can 401 goes through `guardedCall` from `src/lib/authEvents.ts`. In practice this means every consumer call routes through the guarded SDK surface (`guardedTablesDB`, `guardedStorage`, `guardedFunctions`, `guardedAccount` — see §15). Do not construct raw `TablesDB`/`Storage`/`Functions`/`Account` outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`; ESLint `no-restricted-imports` blocks it
- Raw `fetch` calls that can 401 (image blob fetches in `storage.ts` and `exportData.ts`) wrap their `fetch` in an outer `guardedCall` and throw `makeUnauthorizedError()` on `r.status === 401`; this requests session confirmation rather than directly expiring authentication
- `guardedFunctions.createExecution` requests session confirmation when `execution.responseStatusCode === 401`, but returns the original Execution unchanged. A Function's business response (including `missing scope`) remains an operation failure for `friendData.ts`, `messageDelivery.ts`, and their queues; it is not direct proof that the cookie/session is invalid
- On `isUnauthorizedError(err) === true`, `guardedCall` calls `dispatchUnauthorized()`. The `auth:unauthorized` event means **session verification requested**, and simultaneous requests are deduplicated
- `AuthProvider` listens for `auth:unauthorized` and runs its generation-guarded live `account.get()` verification. It preserves the current/cached user while that request is pending. Success preserves auth and clears transient auth errors; a network/timeout failure preserves auth and reports offline connectivity; only a confirmed 401 from `account.get()` clears the cache/user, shows the session-expired error, and lets `AppLayout` redirect to `/login`
- `src/lib/friendData.ts` and `src/lib/messageDelivery.ts` inspect the returned Function status/body and retain their domain-specific UI and queue behavior. Session confirmation is an independent side effect and must not replace those operation results
- Do not redirect from the call site. Always dispatch and let the provider drive the redirect

### 23.5 Multi-Tab Auth Sync
- Login and logout both write `JSON.stringify({ type: 'login' | 'logout', at: Date.now() })` to `localStorage` under `mosaic_auth_broadcast`
- Every other tab listens via the `storage` event. On `logout`, it clears local user state. On `login`, it re-runs `resolveInitialUser()` to pick up the shared Appwrite cookie
- Never broadcast tokens or credentials — only the event type
- Not a replacement for server-side session invalidation; it is a UI consistency mechanism

### 23.6 Offline vs Unauthenticated
- **401 from live `account.get()`** → definitely not logged in → clear cached identity → protected routes redirect to `/login`.
- **401 from any non-Account operation** → request a deduplicated `account.get()` confirmation while preserving the operation's original response/error. It cannot directly clear authentication state; only a 401 from that confirmation proves the session is gone.
- **Valid cached identity** → hydrate that account synchronously and render local startup immediately, even when `navigator.onLine` is true. The live session check is background reconciliation and never owns the page-level loading state.
- **No cached identity** → Login remains immediately usable while the one AuthProvider-owned live session check runs in the background. If an existing session is found, Login redirects to Home; if Appwrite is unreachable, the form stays usable.
- **Connectivity authority** → `navigator.onLine === false` is a hard offline hint, but `navigator.onLine === true` means only "a network interface may exist." Mosaic starts in **Checking**, becomes **Online** only after a successful Appwrite response (or HTTP/Appwrite error response proving reachability), and becomes **Offline** after a network/timeout failure. Browser online/offline, Network Information change, focus, and visibility events trigger re-checking; they do not directly claim Online.
- Auth generation/race protection is mandatory. Results from a session check started before login, signup, logout, cross-tab auth change, or another confirmed auth transition must not overwrite the newer auth state.
- Cached identity is authorization only for that same account's already-local data. Every RxDB/cache lookup remains owner-scoped; auxiliary caches that contain user/social data must also include the current owner in their key.
- The `OfflineError` class in `src/lib/authEvents.ts` remains the canonical "couldn't check" signal at the SDK-wrapper layer. Do not reinterpret it as 401.
- Remote session revocation cannot be learned while a device is genuinely disconnected. Offline access to already-local data is therefore intentionally bounded by the last verified identity until connectivity returns; reconnect immediately re-verifies the session.

### 23.7 Things Not To Do
- Do not add `account.get()` calls to a hook or component. If you need session state, call `useAuth()`
- Do not call `account.deleteSession` outside `AuthProvider`. Login/signup may clear a stale current session before proving the requested email/password identity; logout owns explicit sign-out.
- Do not navigate away from a protected screen on `logout()` failure. Surface an error and stay put
- Do not merge `authContext.ts` into `AuthProvider.tsx` — it breaks fast refresh
- Do not treat offline errors as 401. The whole point of `isOffline` is that they're different
- Do not import `TablesDB`, `Storage`, `Functions`, or `Account` from `'appwrite'` outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`. ESLint rejects it, and it defeats the guarded surface

### 23.8 Permanent account erasure

**Delete Account** is a privacy-sensitive exception to Mosaic's ordinary tombstone-retention
protocol. The browser never hard-deletes synchronized server rows itself, and the target
comes exclusively from Appwrite's authenticated user identity after the user types exact
`DELETE`.

A deterministic server-only `account_deletions` row is a durable deletion **intent and
write fence**, but it is not by itself the irreversible privacy boundary. New jobs begin in
`preparing`. The irreversible pivot is successful persistence/authentication of the
encrypted DR privacy-deletion marker outside Appwrite. No profile hiding, Auth disable,
session revocation, row/file deletion, or other destructive server cleanup may occur before
that marker succeeds.

After the privacy pivot, deletion only moves forward. The worker disables Auth/revokes
sessions, hard-deletes owned and cross-user state, transactionally scrubs supported peer
references, verifies no live trace, deletes the Auth principal, then performs a post-Auth
reconciliation/verification while the durable job still fences trusted Function writes.
Only a clean final pass removes the job. Duplicate/overlapping workers are idempotent:
already-missing rows/files/users are success-equivalent.

The browser persists a deletion intent before dispatch, including the deleting user ID and
normalized account email for safe later-login matching, suspends that account's work, and
broadcasts `deletion_pending` to sibling tabs. A timeout/lost response never restarts the
old sync owner. A retained pre-pivot server job (`accepted:false, deletionPending:true`)
keeps the browser frozen until server maintenance or a later authenticated retry can finish.
A confirmed pivot (`accepted:true`) signs out and account-scoped local erasure removes the
deleting user's live RxDB rows without destroying another account's local rows. RxDB may
retain internal deletion tombstones until normal cleanup; do not force collection-wide
zero-age cleanup that could discard another account's replication tombstones.

Surviving peer-owned task reactions and `friend_carousel_prefs` are scrubbed during erasure
and sanitized against the live accepted friendship graph before later replication pushes, so
a stale offline peer cannot reintroduce an erased former-friend ID. Malformed structured
metadata fails privacy-first when it can contain the erased ID.

Every portable backend table/bucket requires an explicit erasure classification and automated
worker-policy parity coverage. DR privacy markers are deterministic, immutable/retry-safe,
and key-version aware; old marker keys must remain available through
`DR_ENCRYPTION_KEYS_JSON` after rotation. Restore authenticates privacy markers before
creating target resources and must never resurrect a marked account from older snapshots.

Disconnected third-party devices cannot be physically wiped while offline. A generic
expired/missing-session 401 by itself is not treated as proof of deletion because doing so
would break Mosaic's ordinary offline-session semantics. When this browser already holds a
matching persisted deletion intent, however, an authoritative 401 evicts that intended
account's local rows while retaining the intent if server acceptance is still uncertain.
A later failed login may trigger the same pending-deletion cleanup only when the normalized
login email matches the persisted intent; a different account's failed login must never
purge it. Immutable DR ciphertext/provider operational logs may also remain according to
retention policy; the guarantee is erasure of live/restorable Mosaic account data and
prevention of DR resurrection.

The authoritative state machine, failure matrix, resource policy, limitations, testing, and
rollout procedure are in [Permanent account erasure](ACCOUNT_ERASURE.md).

## 24. Test Suite

### 24.1 Overview
Vitest 3.x uses three projects (`unit`, `handlers`, `dom`); current counts come
from discovery and runner output. Config lives
in `vitest.config.ts`, while shared project patterns live in
`scripts/lib/test-projects.mjs`. Run the narrow file/project commands in
`docs/TEST_WORKFLOW.md` during iteration. Cross-cutting runtime batches still pass lint,
full tests, and build; the installer in §5.1 runs the same gate.

### 24.2 Project layout
| Project | Environment | Include |
|---|---|---|
| `unit` | node | `tests/unit/**/*.test.ts` |
| `handlers` | node | `tests/handlers/**/*.test.ts` |
| `dom` | happy-dom | `tests/{react,components,hooks}/**/*.test.tsx` |

The `dom` project loads `tests/setup/react.ts` (jest-dom matchers +
`afterEach(cleanup)`) and sets `NODE_ENV=test` — required by React 19's `act`. The `unit`
and `handlers` projects run in plain node with `globals: true`. `npm run test:discovery`
fails if a test belongs to zero or multiple projects; all projects use a conservative
four-worker cap. See `docs/TEST_WORKFLOW.md` for scoped and benchmark commands.

### 24.3 Test philosophy — contracts, not internals
Tests assert observable behavior: what a pure function returns, what a hook exposes through its public surface, what side effects a handler triggers on the mock DB, what a component renders for a given prop combination. They do NOT assert subscription counts, re-render counts, memoization bail-outs, effect re-fire counts, or RxDB document identity. If a test would break from a pure refactor that preserves external behavior, it is a liability — propose deleting it rather than patching it. Rationale and two documented examples (`useMessages` CONFLICT-retry not written; `useTaskImage` deferred-revoke written + flagged) live in the archived project history.

### 24.4 Handler helper — `tests/helpers/invoke-handler.ts`
Injects a mocked `node-appwrite` module into `require.cache` via `createRequire`, then `require`s the real `appwrite-functions/message-action/main.js`. The mock provides `Client`, `TablesDB`, `Storage`, `Users`, `Functions`, `Query`, `Permission`, and `Role`. `makeMockDb()` supplies row/transaction spies, while `makeMockStorage()`, `makeMockUsers()`, and `makeMockFunctions()` isolate privileged account-erasure effects. Each test queues specific `mockResolvedValueOnce`/`mockRejectedValueOnce` responses per call. `invoke({ userId, body, mockDb, ...services })` constructs a synthetic request (including `x-appwrite-user-id` when authenticated) and captures `res.json` calls to return `{ body, status, logs, errors }`. Every handler action is tested end-to-end without a live Appwrite.

### 24.5 Hook helper — `tests/helpers/testDb.ts`
**The helper deliberately diverges from `src/db/database.ts`.** Considered choice, not drift; a long header comment in the file documents the reasoning. Summary:
- **No `RxDBDevModePlugin`** — dev-mode loads a remote iframe from `rxdb.info` on first DB creation; its `BroadcastChannel` is unimplemented in happy-dom and the unhandled `ReferenceError` fails the run even when assertions pass. Dev-mode's checks are dev-mode-only and catch nothing real in a fresh, unique-named, never-migrated test DB.
- **Storage:** `wrappedValidateAjvStorage({ storage: getRxStorageMemory() })` — same validator production uses; Ajv is the meaningful safety net, dev-mode is not.
- **Migration strategies for `tasks` (v1), `friendships` (v1), `messages` (v3), `categories` (v1), `settings` (v1)**, mirroring `database.ts`. Strategies are pure pass-throughs / empty-default backfills. **These MUST stay in lock-step with production** — any version bump there requires the same change here, and the §12 migration checklist calls this out.
- **Collection profiles:** RxDB-backed React tests request only `messages` or `friendships`
  when that is all they exercise. The default `all` profile retains full-schema coverage for
  tests that need it.
- **`multiInstance: false`**, unique DB name per `createTestDb()` call. Parallel test files in separate workers never collide.

Do not add a "test-mode" branch to `src/db/database.ts`. The `vi.mock` pattern in each hook test file is the mechanism.

### 24.6 Hook mock pattern
Vitest hoists `vi.mock` above all imports; the factory cannot reference imported bindings unless declared via `vi.hoisted`. Every hook test file inlines this boilerplate:

```ts
const dbRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => {
    if (!dbRef.current) throw new Error('testDb not initialized');
    return dbRef.current;
  },
}));
```

Lifecycle per hook test file: `beforeEach` → `dbRef.current = await createTestDb()`; `afterEach` → `await destroyTestDb(dbRef.current)`. `useMessages.test.tsx` additionally mocks `../../src/lib/threads` and `../../src/lib/messageDelivery`. `useTaskImage.test.tsx` mocks `../../src/lib/storage` and stubs `globalThis.URL.revokeObjectURL`.

### 24.7 Adding new tests
- Pure function → `tests/unit/<name>.test.ts` (node, `globals: true`)
- Appwrite Function action → `tests/handlers/<action>.test.ts` using `invoke-handler.ts`; queue mock responses with `mockResolvedValueOnce`
- Hook → `tests/react/<hookName>.test.tsx` with the §24.6 mock pattern (skip `testDb.ts` entirely if the hook has no RxDB dependency)
- Component → `tests/components/<ComponentName>.test.tsx` (happy-dom + `@testing-library/react`). Mock `react-router-dom`'s `useNavigate` for navigating components; mock `../../src/lib/storage` for image-rendering components. Prefer asserting on rendered text/labels and firing user events over asserting on internal state.
- Provider → `tests/react/<ProviderName>.test.tsx`. Render a consumer hook via a `wrapper` component mounting the provider. For providers consuming `useAuth`/`useFriends`, mock those dependencies at module level with `vi.hoisted` refs so the test can drive user/friendship state. See `ConversationsProvider.test.tsx` and `FriendsProvider.test.tsx`.
- Sync engine → `tests/unit/sync.test.ts`. The module has module-level state; each test uses `vi.resetModules()` in `beforeEach`, establishes the active account work scope, then dynamically imports `../../src/db/sync`. `guardedTablesDB` and `guardedAccount` are mocked with `vi.hoisted` spies. Compatibility-state assertions read the account-scoped `lastSyncTimePerCollection_<userId>` key; tests that intentionally exercise migration seed the legacy unsuffixed key explicitly.

### 24.8 Regression comments
Use a regression comment when a durable requirement pointer materially helps future
maintenance. For this reference, use `// Regression: §<section> (<contract name>)`;
for another authoritative document, name that document and contract explicitly. Examples:
`// Regression: §20.5 (read-receipt retry flow)`,
`// Regression: §10 (CONFLICT is not an error)`, and
`// Regression: TOMBSTONE_RETENTION.md (90-day garbage collection)`.

Regression comments point to the current canonical requirement; they do not preserve
historical implementation tickets. Once a requirement is formalized, do not leave
`task acceptance`, `UIFIX-*`, `F*`, `A*`, `PH-*`, or similar audit/task IDs as the
only source. Test names describe the behavior being protected, not the old issue ID. If no
durable source exists and the test is still valuable as ordinary unit coverage, omit the
regression comment rather than inventing permanent traceability. When a referenced contract
changes, review the test — the comment is a pointer, not enforcement.

### 24.9 Generated service-worker policy

`npm run build` runs `scripts/check-service-worker.mjs` after generating production
assets. It fails on automatic `skipWaiting` during startup/install/activate,
activation from unrelated messages, client claiming, a missing offline navigation
fallback/API exclusions, a JS/CSS app chunk absent from precache, a precache URL that
is not a same-origin emitted file, or invalid manifest identity/install metadata. The same
inspector powers `scripts/audit-bundle.mjs`, which separately reports conditional
activation on an explicit `SKIP_WAITING` message.

The inspector executes trusted generated worker code against observable Workbox
stubs. It verifies generated wiring, not actual browser lifecycle or networking;
unsupported generated APIs fail rather than report a safe result. After upgrades,
check the emitted worker and adjust the inspector if its format legitimately changes.

Browser verification protocol for changes to this policy:

1. Serve production builds on one origin. Install version A and open two controlled
   tabs. Use a separate test browser profile; leave DevTools "Update on reload" off.
2. Serve version B and trigger an update check. Confirm it becomes installed/waiting,
   the old controller stays active, and an unsaved input in the first tab survives.
3. Refresh the second tab, then close it. The update must still wait while the first
   controlled tab remains. Close all controlled tabs/app windows and let B activate.
4. Reopen offline on a nested route and fetch an app chunk not previously opened.
   Confirm the cached shell/chunk and persisted local data remain available. API
   navigation paths `/api/*` and `/v1/*` must not receive the SPA HTML fallback.
5. Repeat with a fresh profile: first install must not claim the existing page, and
   the next navigation must be controlled. Exercise subsequent B → C updates too.

The 2026-09-19 fix passed these lifecycle checks in isolated Chromium, including
the old `autoUpdate` → new `prompt` transition, a subsequent waiting update, a
localStorage persistence marker, and the unopened PhotoSwipe chunk offline. External
Appwrite calls were blocked; this was not an authenticated sync or mobile/Safari test.
The existing 390-test suite supplies separate auth/sync regression coverage.

Waiting activation does not guarantee old assets remain available to uncontrolled
pages or after cache eviction. Before deploying Phase 3.2, verify hosting headers
and old-asset availability, plus explicit recovery for rejected lazy imports. The
repository currently has no hosting configuration to establish those guarantees.

### 24.10 Route and interaction splitting

Phase 3.2 route tests cover the chunk-error classifier and its distinct reload UI.
Build verification checks that every generated JS/CSS chunk is precached. Bundle
verification checks static closures: initial and first Home must exclude
`emoji-picker-react`, `browser-image-compression`, `fflate`, and `photoswipe`.

The 2026-09-19 browser run exercised every direct route offline while a replacement
deployment waited, then loaded a replacement split route after activation. It also
reproduced a missing chunk without a service worker and recovered through the explicit
reload action. See the Phase 3.2 result in the bundle-size budget and Git history.
This is not a substitute for checking real hosting headers or mobile/Safari after the
first split deployment.

### 24.11 Visibility-gated image acquisition

Hook tests assert that disabled images issue no acquisition, enabling starts exactly one
request, shared file IDs deduplicate, and rejected IndexedDB reads clear loading state.
Observer tests pin the 200px preload margin, eager fallback, unsupported-browser fallback,
and latch behavior. `DeferredAvatar` component tests count calls at the
`getLocalImageUrl` boundary.

The 2026-09-19 Chromium harness exercised the real hook and IndexedDB object store. With
one eager header and 20 scroll rows, the initial read set was `header`, `row-0`, and
`row-1`; bottom scroll added `row-18` and `row-19`; returning added none. This verifies
browser intersection/scroll behavior with cached blobs. It does not replace a live
Appwrite, mobile/Safari, or production-data trace.

### 24.12 Bounded image-cache LRU

Phase 3.4 upgraded `mosaic_image_cache` to version 2 while leaving blob values and keys
unchanged. A separate `metadata` store records actual blob size and last successful access.
The cache budget is 50 MiB—enough for roughly 340 maximum-size 150KB compressed images—so
normal offline libraries remain warm without allowing unbounded origin growth.

A successful cache read refreshes access time. Startup runs a lazy, non-blocking sweep;
each cache write sweeps before and after insertion. Sweeps total actual `Blob.size`, remove
stale metadata, then evict oldest access times with `fileId` as the deterministic tie-break.
Legacy blobs have no metadata and therefore start at access time 0: they remain readable,
receive metadata when retained/read, and are evicted before known recently-used entries.
Deleting an image removes both records. Access-metadata write failure is fail-soft—the
already-read blob is still returned. Cross-tab access-versus-sweep timing is approximate;
the worst case is an unnecessary refetch, never loss of the Appwrite source file.

Unit coverage pins byte accounting, access refresh, deterministic legacy handling, stale
metadata cleanup, overwrite/delete behavior, and fail-soft cache hits. A real-browser
quota/eviction trace remains a manual check because the unit IndexedDB stub cannot emulate
browser quota pressure.

### 24.13 PWA update, install, precache, and sharing

Phase 3.5 replaced the plugin-injected registrar with `pwaLifecycle.ts`, which captures
`beforeinstallprompt` and registers the worker exactly once through
`virtual:pwa-register`. App-version updates are independent of RxDB/Appwrite data sync: `forceSync()` does not check the service worker. Settings exposes the app release version and deployment build identity plus the app-update control above the destructive data controls. The combined Alerts and versioning Preview began at **0.5.0**; its next user-testable Settings disclosure revision is **0.5.1**. Production remains on its independently verified version until an approved release. Settings shows only Version and its number by default; expanding Version reveals the effective Appwrite production/scratch backend (or custom/unknown), branch, commit, and separately expandable multiline commit message. Preview/dev builds must use Scratch while official production builds use Production; release-version and build-identity rules live in `docs/VERSIONING.md`.

Update acquisition is intentionally moved off the user's critical path. More than one minute after post-paint maintenance starts, Mosaic performs a quiet service-worker update check when the document is visible and the browser is online, then rate-limits subsequent background checks to at most hourly; returning online or foregrounding the app can trigger an overdue check. This pre-download must never gate auth, Home, RxDB readiness, or first interaction. A background check never activates an update: a replacement worker still waits for explicit approval.

Production builds enable Vite's chunk-import-map optimization so changing one hashed dependency does not transitively change every importing chunk's URL. The emitted `importmap.json` is part of the service-worker precache and build verification rejects a missing/empty map. This preserves hashed chunks and full offline app-shell coverage while reducing the bytes a normal incremental PWA update must fetch. Because Vite currently marks this optimization experimental and it requires `import.meta.resolve`, installed-PWA acceptance must continue to cover supported Android/Samsung and Safari/iOS lifecycle paths before promotion.

Manual checks reuse the registration captured from vite-plugin-pwa; if that callback does not provide one, they fall back to the standard `navigator.serviceWorker.getRegistration()` lookup and then, for an already-controlled page, `navigator.serviceWorker.ready`. An already-waiting worker is immediately ready to install. If a worker is already installing, the manual action joins that install rather than calling `update()` again. User-visible stages distinguish checking, found/downloading, ready, current, unavailable, failure, and a long-running download that continues in the background. A slow install must never be reported as “up to date”, and a worker that becomes `redundant` during installation is an error rather than success. When the waiting worker is ready, the Settings row itself becomes **Update now** while `PwaPrompt` remains the global surface for updates discovered elsewhere.

Updates activate and reload only after **Update now**; **Later** leaves the waiting worker
untouched. Installation calls the saved browser prompt only after the user chooses
**Install**. Browsers that do not emit `beforeinstallprompt` show no custom install UI;
iOS users continue to use Safari's Add to Home Screen command.

The generated manifest has stable `id`, root scope/start URL, standalone display, and
192/512 icons. Build verification proves each precache entry resolves to a same-origin
file emitted in `dist`; all JS/CSS chunks and the offline navigation shell remain required.
RxDB rows, Appwrite responses, and downloaded user images are not emitted build files and
therefore cannot enter this precache. The inspector still rejects unexpected runtime
routes, so the worker remains an app-shell cache rather than a second data cache.

The Profile share action sends only a Mosaic invitation, username/display-name label, and
the public app root through Web Share. It never includes the bio, email, user ID, cached
image, or other local data. When Web Share is unavailable or fails, it copies the same
invitation; cancellation does not copy unexpectedly. Mosaic has no public-profile deep
link yet, so the shared URL deliberately opens the app root rather than the private
`/profile` settings route.

Automated coverage pins prompt capture/dismissal, explicit update activation, post-takeover
reload, share cancellation/fallback, prompt UI controls, static-only precache validation,
and manifest identity. Browser release verification still requires:

1. Install from a fresh Chromium profile and confirm the captured prompt appears only when
   the browser declares the app installable; dismiss and accept it on separate runs.
2. With version A controlling two tabs, serve version B. Confirm **Later** preserves A and
   unsaved input in both tabs. Choose **Update now**, confirm B takes control, and confirm
   the approved reload occurs once.
3. Relaunch the installed app offline into Home and a nested route that was not opened
   before disconnecting. Confirm the shell, lazy chunk, cached identity, and local data.
4. Verify Safari/iOS shows no broken custom install control, then install through Share →
   Add to Home Screen. Repeat update/offline checks on an installed Android PWA.
5. Exercise Profile sharing with native Web Share, cancellation, clipboard fallback, and
   denied clipboard permission. Confirm the payload contains no private profile data.

### 24.14 Production build-size guard

`npm run build` runs `scripts/check-build-size.mjs` only after TypeScript, Vite, and the
generated service-worker policy pass. Vite emits `.vite/manifest.json` for post-build graph
measurement; Workbox explicitly excludes that metadata file from precache. The guard reads
the emitted module entry from `index.html`, follows Vite's **static** import graph for the
initial app closure and the Home closure, totals every emitted JavaScript/CSS asset, and
totals unique precache files from the generated worker.

Production deployments embed a variable Git commit subject/body into the
`mosaic-build-info` meta tag in `index.html`. The unique precache **size regression
metric** discounts only that tag's variable `content` attribute bytes, so the same
application code doesn't fail its guard when a merge has a descriptive longer
commit message. All other index HTML, app assets and precached files remain
counted. The actual built HTML, cached bytes and expanded Settings commit
message are never truncated or excluded from the real deployment; the
reviewed budget ceiling is not raised.

Avoid dynamic `import.meta.env[name]` lookups in shipped code. Vite must
materialize an environment object for such access, including deployment-
specific `VITE_*` metadata, which can change bundled JS bytes between the
identical accepted Preview tree and its `dev` merge. Use explicit
`import.meta.env.VITE_...` references for known Appwrite configuration keys,
then retain the fork-safe fallback resolution. This reduces cross-branch
bundle drift without discounting genuine app code from size budgets.

The guarded metrics are:

- entry raw bytes
- entry gzip bytes
- initial static-closure gzip bytes
- Home static-closure gzip bytes
- aggregate app-asset raw bytes
- aggregate app-asset gzip bytes
- unique raw PWA precache bytes

These are regression ceilings, not performance goals. Hashed output names are intentionally
ignored. A budget failure requires graph inspection and either a measured size fix or a
documented decision to accept the growth before changing the baseline/limit. Never raise a
threshold solely to make verification pass.

The reviewed 2026-10-03 baseline is commit `9ca52e2`, after the production graph audit and
startup/Home deferral pass:

- entry: 423,122 B raw / 125,240 B gzip
- initial static closure: 472,803 B raw / 136,883 B gzip
- Home static closure: 1,114,771 B raw / 339,955 B gzip
- aggregate JS/CSS assets: 2,195,734 B raw / 667,418 B gzip
- unique PWA precache: 2,269,326 B raw

Entry and startup/Home closure ceilings carry about five percent headroom from the reviewed
baseline. Aggregate/precache ceilings remain intentionally tight and are not raised merely to
create CI headroom. A reviewed 2026-10-06 exception accepts the TodoMate task-sync
observability/throughput feature: exact RxDB-confirmed `completed/total` cloud progress plus a
bounded, Appwrite-rate-aware create worker pool added about 545 B gzip to aggregate app assets
(682,281 B → 682,826 B in comparable Preview builds), while entry, startup/Home closures,
aggregate raw bytes, and precache all stayed within their existing ceilings. Only
`appAssetsGzipBytes` is therefore revised from 682,300 B to 683,500 B, leaving roughly
674 B of measured headroom for gzip variation without widening the other guards.

A reviewed 2026-10-07 exception accepts the restored category-visibility controls and the
existing Lucide pencil edit affordance. Comparable Vercel builds measured current `dev` at
683,385 B aggregate gzip and the complete category-visibility Preview at 683,677 B (+292 B).
The aggregate gzip ceiling is therefore revised from 683,500 B to 684,400 B, leaving about
723 B of measured provider headroom. Entry/startup/Home, aggregate raw, and precache ceilings
are unchanged. This is accepted product growth plus build-provider gzip variance, not a
threshold increase made solely to silence verification.

A second reviewed 2026-10-07 exception accepts the accent-customization feature: per-account
pre-React accent caching, synced appearance state, accessible derived accent tokens, 20 curated
accent choices, and 20 additional curated category colors. The complete Vercel Preview build
measured 686,313 B aggregate gzip and 2,319,808 B unique precache while entry, startup/Home
closures, and aggregate raw bytes all remained inside their existing limits. The aggregate
gzip ceiling is therefore revised from 684,400 B to 687,200 B and the precache ceiling from
2,318,400 B to 2,320,800 B, leaving 887 B and 992 B of measured headroom respectively.
Entry/startup/Home and aggregate raw ceilings remain unchanged. This is reviewed product growth,
not a blanket threshold increase.

A third reviewed 2026-10-07 exception accepts Day View bulk Move to Category. Before
accepting growth, the implementation removed a one-off icon and redundant picker/runtime code,
reducing the first GitHub feature build from 2,321,510 B unique precache to 2,320,796 B. The
provider-matched Vercel comparison then measured the immediately preceding accepted Preview at
686,337 B aggregate gzip / 2,319,875 B unique precache and the final bulk-move Preview at
686,968 B / 2,322,600 B: +631 B aggregate gzip and +2,725 B precache. This agrees with the
GitHub precache delta (+2,723 B) while also capturing Vercel's build-environment variance.
The aggregate-gzip ceiling is therefore revised from 687,200 B to 688,000 B and the precache
ceiling from 2,320,800 B to 2,323,600 B, leaving 1,032 B and 1,000 B of measured Vercel
headroom respectively. Entry, startup/Home closures, and aggregate raw remain unchanged. This
records approved product growth after measured trimming and provider-matched verification, not
a blanket threshold increase.

A fourth reviewed 2026-10-07 exception accepts the Notifications/Alerts feature after the
generated-worker verification fix exposed its complete production graph. Provider-matched
Vercel builds measured the immediately preceding accepted `dev` at 2,247,422 B aggregate raw /
686,912 B aggregate gzip / 2,322,431 B unique precache and the complete Alerts Preview at
2,268,387 B / 694,711 B / 2,346,954 B: +20,965 B raw, +7,799 B gzip, and +24,523 B
precache. The growth is attributable to the new lazy Alerts route plus its notification cache,
push-registration client, shared action dependencies, and the checked-in push service-worker
handler; entry, initial static closure, and Home closure remain inside their existing ceilings.
The aggregate-raw ceiling is therefore revised from 2,254,900 B to 2,269,500 B, aggregate gzip
from 688,000 B to 695,800 B, and unique precache from 2,323,600 B to 2,348,000 B, leaving
1,113 B, 1,089 B, and 1,046 B of measured Vercel headroom respectively. Entry and startup/Home
ceilings remain unchanged. This is measured product growth, not a blanket threshold increase.

A fifth reviewed 2026-10-08 exception covers the incremental Alerts retention and
friend-task navigation upgrade. Provider-matched Vercel builds measured the previous
accepted Alerts Preview at 2,269,259 B aggregate raw / 694,953 B aggregate gzip /
2,347,812 B unique precache and the upgraded Alerts Preview at 2,280,215 B /
700,313 B / 2,359,848 B. The increases (+10,956 B raw, +5,360 B gzip,
+12,036 B precache) come from the new lazy Notifications Settings route,
lazy friend-task detail sheet, retention/grouping and read-visibility logic.
Entry, startup and Home closure remain under the existing reviewed ceilings.
After that provider-matched measurement, only aggregate raw/gzip and precache
ceilings rise to 2,281,400 B / 701,400 B / 2,361,000 B, retaining 1,185 B,
1,087 B and 1,152 B headroom. This is scoped product growth, not an
unconditional size-budget reset.

A sixth reviewed 2026-10-08 exception covers the Alerts Friend Day View
gesture and fast, live-authorized single-task lookup. Provider-matched Vercel
builds measured the preceding accepted Preview at 2,280,215 B raw / 700,313 B
gzip / 2,359,848 B unique precache and this upgrade at 2,283,283 B raw /
701,084 B gzip / 2,362,838 B precache: +3,068 B raw, +771 B gzip and
+2,990 B precache. The growth is scoped to parent-aware route gestures,
the lazy alert task sheet, the secure fast lookup client and focused
interaction feedback; server Function source does not inflate the client
bundle. Entry, initial static closure, and Home static closure remain below
the previous unchanged ceilings. To preserve about 1 KB measured headroom,
aggregate limits are revised to 2,284,500 B raw / 702,200 B gzip /
2,364,000 B unique precache, leaving 1,217 B / 1,116 B / 1,162 B
respectively. This is measured feature acceptance, not unbounded slack.

A seventh reviewed 2026-10-08 exception accepts mobile notification tap-to-task routing,
per-device opt-in detailed push copy, and the shared Alerts sheet exit lifecycle.
Provider-matched Vercel output for the preceding accepted gesture/fast-task Preview
was 2,283,283 B aggregate raw / 701,084 B aggregate gzip / 2,362,838 B
unique precache; the complete notification-navigation Preview measured
2,286,639 B / 702,236 B / 2,367,425 B: +3,356 B raw, +1,152 B gzip,
and +4,587 B precache. Independent GitHub Actions measured 2,284,560 B raw /
701,149 B gzip / 2,364,611 B precache for that same tree. The measured
growth comes from the browser notification click path, authorized deep links,
device push-detail preference, and sheet lifecycle; backend Function/schema
source is not shipped in the frontend asset graph. Entry, startup and Home
static closure limits are unchanged and all passed. Based on those provider-
matched values, aggregate raw/gzip/precache ceilings are revised to
2,287,800 B / 703,400 B / 2,368,700 B, leaving 1,161 B / 1,164 B /
1,275 B of measured Vercel headroom. This is scoped reviewed product growth
rather than general budget expansion.

An eighth reviewed 2026-10-08 exception accepts the opt-in, device-local
foreground push preference for Chromium/Samsung, including visible-window
checks and a documented WebKit fallback that always displays delivered pushes.
Provider-matched Vercel output for the preceding notifications Preview was
2,286,639 B aggregate raw / 702,236 B aggregate gzip / 2,367,425 B
unique precache; the completed foreground-toggle Preview measured
2,288,564 B / 702,831 B / 2,371,091 B, respectively. These measured
increases (+1,925 B raw, +595 B gzip, +3,666 B precache) represent
the additional device preference UI, shared worker IndexedDB setting,
visible-client policy and tests/docs. Independent GitHub output measured
2,286,629 B raw / 701,801 B gzip / 2,368,563 B precache. Entry,
initial startup closure and Home static closure all remained under
their existing unchanged limits. After measuring both providers, the three
aggregate ceilings are revised to 2,289,800 B raw / 703,900 B gzip /
2,372,400 B precache, retaining 1,236 B / 1,069 B / 1,309 B of
Vercel headroom. This is scoped feature growth rather than an
unconditional size guard increase.

A ninth reviewed 2026-10-08 exception accepts **account-synced, independently
configurable Alerts history**. A comparable GitHub diagnostic build initially fit
the previous ceilings, but the actual Vercel environment emitted 2,291,198 B
aggregate raw / 704,042 B gzip / 2,374,031 B precache and exceeded the
old ceilings by 1,398 B / 142 B / 1,631 B. The growth is from two
Notification Settings controls, retention-policy logic and the recoverable
offline feed cache; the Appwrite Function source is not shipped with the PWA.
The unchanged entry/startup/Home limits still pass. The three aggregate caps
are increased only to 2,293,300 B raw / 705,100 B gzip / 2,375,900 B
precache, leaving 2,102 B / 1,058 B / 1,869 B against the measured
Vercel build, rather than disabling or generally loosening the guard.
This is the approved feature's measured production cost, not arbitrary budget
growth.

A tenth reviewed 2026-10-09 exception accepts **profile/category save
lifecycle safety (v0.6.2)**: single-flight saves, error feedback and retryable
name, description, and category create/update/delete forms. The scoped shared
save hook and propagated local category write errors are small additions to
existing lazy routes; no new runtime package, backend Function, Appwrite schema,
sync pipeline, or visual redesign is introduced. The existing Vite entry,
initial static closure, and Home static closure all pass unchanged ceilings.

Provider-matched Vercel builds measured the immediately preceding accepted
v0.6.1 Preview `5f1d4c8e` at **2,293,734 B** aggregate app-asset raw /
**704,926 B** aggregate gzip / **2,375,849 B** unique precache, and the
complete v0.6.2 form-action Preview `d9df80ea` at **2,295,455 B** raw /
**705,773 B** gzip / **2,377,890 B** precache. The measured increments are
**+1,721 B raw / +847 B gzip / +2,041 B precache**, consistent with the
independent GitHub production build deltas of +1,721 B / +846 B / +2,041 B
respectively. The change primarily enlarges the lazy profile and category
routes rather than the entry or Home closure. These values were collected
from failed size-only CI and Vercel builds after TypeScript, Vite and the
PWA policy had already passed; all other CI shards were green.

The three aggregate limits alone are therefore revised to **2,296,600 B
raw / 706,900 B gzip / 2,379,100 B precache**, leaving **1,145 B / 1,127 B /
1,210 B** of measured Vercel headroom for this explicitly accepted, useful
failure/retry behavior. The original reviewed baseline and the entry,
startup and Home ceilings remain unchanged. The build-size guard is still
mandatory; this is a bounded, measured product exception rather than
general CI relaxation.

The current baseline and limits live in
`config/build-size-budget.json` and are pinned by unit coverage.

`npm run build:size` checks an existing `dist/`. The diagnostic
`scripts/audit-bundle.mjs` remains the source for per-chunk package/module attribution,
static-closure raw sizes, deferred-package leak checks, source reachability, declared
production-dependency attribution, and PWA precache inspection. Deleting an unreachable
source file is repository cleanup only; it is not a production bundle-size win unless the
file was part of the emitted graph.

### 24.15 PostHog error tracking and feature flags

Phase 3.7 establishes a single PostHog ownership boundary in `src/lib/posthog.ts`.
Mosaic deliberately does not ship the PostHog browser SDK: the Phase 3.6 aggregate/precache
budgets do not have room for its runtime bundle. The adapter uses PostHog's browser-facing
HTTP contracts directly: `POST /flags/?v=2` for remote flag evaluation and
`POST /i/v0/e/` for `$exception` ingestion. Initialization is lazy and non-blocking;
missing `VITE_POSTHOG_TOKEN` or `VITE_POSTHOG_HOST` makes the adapter a clean no-op so
bootstrap, RxDB, auth resolution, rendering, and offline startup remain independent of
PostHog.

Privacy-minimal behavior is structural rather than configuration-based: there is no
autocapture, pageview/pageleave capture, dead-click tracking, heatmaps, performance
capture, session recording, surveys, rage-click tracking, campaign/referrer persistence,
device-model collection, scroll capture, console capture, or ordinary product analytics.
The adapter installs only browser error, unhandled-rejection, and online listeners plus a
five-minute flag refresh timer. Identity and flag state are memory-only.

`AuthProvider` remains the only session-state owner. Once auth resolution finishes it
passes only the resolved Appwrite `user.$id` (including the OFF-1 cached identity) to the
adapter. Email, display name, preferences, bio, and other person properties are not sent.
The adapter suppresses repeated identification of the same ID. Logout creates a fresh
memory-only anonymous distinct ID; network/offline failures preserve the resolved identity
and therefore do not trigger reset.

Root and route error boundaries keep their existing fallback, retry, navigation, and
chunk-load recovery behavior while reporting handled exceptions with only caller-supplied
diagnostic context. Browser errors and unhandled rejections are reported as unhandled.
Events use PostHog's standard `$exception_list` / raw stack-frame shape so uploaded source
maps can symbolicate production frames. Existing expected retry/network/auth/outbox/sync
logging and `console.error` calls are not promoted into PostHog events.

`useFeatureFlag` is the React consumption boundary. Its public state is
`{ enabled, isLoaded, hasError }`; flags fail closed and remain disabled until a successful
`/flags/?v=2` response. Flag reads emit no `$feature_flag_called` exposure analytics
because the adapter has no product-event capture path. Flags reload after identity changes,
browser reconnect, and on a five-minute timer. Flags must never gate migrations, auth or
sync correctness, destructive operations, offline-data invariants, or any behavior required
for Mosaic to work offline.

Production source-map upload uses `@posthog/rollup-plugin` only when the explicit
`POSTHOG_SOURCE_MAPS_ENABLED=true` build flag is present together with all three build-only
variables: `POSTHOG_PERSONAL_API_KEY`, `POSTHOG_PROJECT_ID`, and `POSTHOG_HOST`. Those
names are deliberately not `VITE_` variables and are unavailable to browser code. The
three credentials alone do not activate upload. Vercel Preview builds additionally force
this upload path off even if the build-only variables are inherited into Preview, because
optional source-map delivery must never make a valid Preview depend on an external upload
service. Production and explicitly opted-in local builds retain the upload path. Opted-in
builds use hidden source maps and request deletion after a successful upload; ordinary
builds create no source maps for this integration. Client configuration continues to use
only `VITE_POSTHOG_TOKEN` and `VITE_POSTHOG_HOST`. The host is never assumed.

IP-discarding is not represented as a client-side setting. If Mosaic requires IP discard,
configure and verify it in the PostHog project. Live verification must also confirm
replay/autocapture/console capture are absent, authenticated distinct IDs equal Appwrite
`$id` with no profile properties, logout creates a fresh anonymous identity, test flags
refresh after identify, intentional exceptions arrive, and uploaded production source maps
symbolicate stacks.

The single GitHub `Quality Gate` workflow's parallel `browser-contract` job runs Chromium against
the real Mosaic browser adapter with Appwrite/PostHog network interception. It verifies the
anonymous → authenticated → fresh-anonymous identity lifecycle, flag reloads after identity
changes, minimal request bodies, handled exception shape, injected chunk/release metadata,
and that Mosaic makes no replay/autocapture request paths. Hosted PostHog checks remain the
authority for actual ingestion, person properties, recordings, project IP discard, and
production source-map symbolication.


### 24.16 Animation performance audit baseline

The stable `perf/animation-optimization` branch contains measured interaction hardening for
DayView and Calendar. DayView preserves all 181 Swiper geometry slides while mounting only
the existing seven-slide expensive render window. The seven-slide window is a fast-swipe
safety buffer and must continue tracking Swiper's active index immediately; do not shrink or
defer that buffer in a way that lets repeated flicks expose empty slides. Parent selected-date
propagation may wait for Swiper's snap to finish so unrelated parent work stays off the
animation path, while the local active index and render window continue following every
`slideChange`. Calendar preserves its 61-slide Embla
geometry while limiting vertical scrolling to the rendered three-slide window. The Chromium
performance probe exercises a heavy fixture, including the real owner DayViewSheet for both
a single swipe and repeated rapid swipes, and reports requestAnimationFrame timing plus
PerformanceObserver long tasks without enforcing a budget. Run it explicitly with
`npm run test:performance`; it is diagnostic and is not part of canonical correctness
acceptance. The 2026-09-25 baseline recorded approximately 60 FPS for calendar month swipe,
day swipe, and heavy day-content scroll; bottom-sheet open had one 64ms long task and a
small 1.45% frame-over-20ms ratio. These runner measurements are diagnostic baselines, not
device guarantees. No additional BottomSheet animation/CSS change is justified without a
device trace or stronger production-equivalent evidence.

### 24.17 Test architecture and UI-contract boundaries

Automated tests protect durable behavior, data safety, accessibility, and browser-only
interaction invariants; they do not freeze incidental implementation. The authoritative
testing rules live in [TEST_WORKFLOW.md](TEST_WORKFLOW.md).

UI tests normally assert semantic/user-observable results: roles, labels, state, content,
focus, navigation, callbacks, domain state, and browser-measured behavior. Tailwind classes,
exact DOM ancestry, decorative transforms, exact colors, spacing, borders, font sizes, and
wrapper ownership are current design choices rather than regression contracts. Detailed
aesthetic/reference-app descriptions elsewhere in this document guide the current product
design but do not automatically require automated presentation assertions. Prefer manual
visual acceptance for those descriptions. Automated geometry assertions are reserved for
observable interaction/accessibility failures such as clipping, overflow, gesture ownership,
or a control escaping its usable bounds.

Where presentation is behavior, tests assert the outcome rather than the mechanism when
possible. Examples include a switch thumb remaining inside its track, no page-level
horizontal overflow at a supported viewport, and a required calendar row remaining visible.
A harmless JSX/CSS refactor that preserves the documented behavior should not require
production changes merely to satisfy a historical test.

Playwright is reserved for failure modes that need a browser engine: gesture arbitration,
scroll/overflow geometry, focus/history, browser APIs, accessibility scans, and browser
network/privacy contracts. Do not mirror every DOM regression in Playwright. Diagnostic
performance probes stay outside canonical acceptance unless a reviewed numeric performance
budget is explicitly adopted.

Strong direct coverage remains mandatory for sync and mappings, account isolation/auth,
offline identity, tombstones and destructive deletion, Appwrite Function authorization,
cross-user writes, queues/outboxes, row-ID/schema parity, and privacy-minimal analytics.
Those protections take precedence over reducing raw test counts.

### 24.18 Offline startup, readiness, and Home status

The offline contract is split into **boot correctness** and **feature completeness**.

- **Boot correctness:** Login is eagerly renderable and mounts without waiting for RxDB or live session verification. A cached account renders a lightweight authenticated shell immediately while the local database/provider bundle opens in parallel; neither Appwrite reachability nor network sync may own a page-level spinner. Home's lazy fallback is a static content skeleton, not the Mosaic spinner.
- **Offline readiness:** a per-account data-ready marker is written only after a full successful sync; a device shell-ready marker is written only after the production service worker reaches an installed/active precached state. Home may show "preparing offline access" while either milestone is missing, but this preparation must not block normal online use.
- **Home status controls:** the Home header shows two compact controls beside Search: connectivity and sync state. Connectivity has three truthful states: **Checking**, **Online**, and **Offline**. Online means Appwrite reachability was actually proven, never merely `navigator.onLine === true`. The sync control distinguishes checking/paused, active syncing (including the current coarse percentage when available), sync-still-finishing, synced/preparing, and real error states. Both controls open the existing Sync Status surface and share the same reachability source used by AuthProvider, global offline UI, sync, image transfer, and remote social work.
- **Own profile:** the caller's social profile is cached per owner and used as stale local state offline; online refresh updates the cache. Profile cache keys must never be shared across accounts.
- **Friend calendars:** cached friend data is keyed by both current owner and friend. Fresh cache may serve online; stale cache may continue serving while offline. Cross-account friend-cache reuse is forbidden.
- **Images:** already-downloaded images remain available from IndexedDB. Task or profile images selected offline are stored in a dedicated pending-image store under a local-only id and remain renderable. Before a task/profile setting carrying a pending image is pushed, sync uploads that blob, patches the local reference to the real Appwrite file id, and only then sends the row. Pending blobs are never subject to the ordinary downloaded-image LRU. Removing a pending image deletes only the local pending blob; it must not issue a remote delete. Backups with photos include referenced pending blobs and restore them to normal Storage ids.
- **Network-only boundaries:** brand-new authentication, username uniqueness/search, never-cached remote friend data, and other inherently remote discovery cannot succeed offline. They must fail fast or use stale local state; they must never block personal task/calendar/diary/settings use.
- **Acceptance:** browser coverage must include the mobile false-positive case where `navigator.onLine === true` while Appwrite requests hang/fail. Cached identity must remain immediately usable, no page-level Mosaic spinner may gate Home/Login, connectivity must transition Checking → Offline after the real failure, and local task edits must survive reload. The production build gate separately proves every emitted JS/CSS chunk plus `index.html` is in the service-worker precache, which covers unopened lazy routes at the shell level. Installed Android/Samsung PWA relaunch with network disabled remains the required end-to-end shell/data manual check; Safari/iOS is a separate manual lifecycle check. Browser storage eviction/site-data clearing remains outside Mosaic's control and must not be described as guaranteed persistence.

## 25. Workflow Portability and History

[AI workflow](AI_WORKFLOW.md) owns the current agent process; [Delivery](DELIVERY.md)
owns promotion and CI rules. Git history and completed issue/PR records preserve
historical project decisions and earlier instruction versions. This reference
preserves stable numbered contract sections for existing links and regressions.
