# Mosaic Project Reference

This document preserves Mosaic's detailed product contracts, architectural
invariants, implementation rationale, and historical decisions. It is reference
material, not an instruction file. `../AGENTS.md` contains the shared active rules.

Sections 5 and 25 summarize workflow boundaries and history. The current deployment branch model is `main` for production, `dev` for staging, and `feature/*` for stable previews; `chatgpt/*`, `codex/*`, `temp/*`, and other branches do not auto-deploy. Active process belongs in
[AI workflow](AI_WORKFLOW.md).

## 0. Hard Rules

1. RxDB schemas: never `deleted` — use `isDeleted` (§12)
2. Synced deletes use `isDeleted: true` tombstones during the retention window; permanent deletion is only performed by the synchronization-safe tombstone GC (§7, `docs/TOMBSTONE_RETENTION.md`)
3. Row IDs ≤36 chars, `[a-zA-Z0-9_]+`, no leading `_` (§6, §11)
4. Existing remote rows: `updateRow`; new rows: `createRow`; 404 fallback on `updateRow`: `createRow`, never `upsertRow` (§6)
5. Outgoing messages: `read_at` is server-owned; omit on push (§12)
6. Message IDs must start with `msg_` — server-enforced (§11)
7. Cross-user writes go through Appwrite Functions, never direct client writes (§6, §20)
8. 401 from `account.get()` = "not logged in"; network error = "couldn't check" — never conflate (§10, §23.6)

### 0.1 Contract sources and enforcement

Mosaic separates project truth by concern. `../AGENTS.md` owns active implementation rules;
this reference owns durable product/architecture contracts; `PLAN.md` owns roadmap
sequencing and verified completion; `SESSION_STATE.md` owns the current checkpoint and
pending verification; the workflow/test/telemetry documents own their named processes.
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

A dark-mode calendar clone of Todo Mate. Shipped: tasks, categories, month/week calendar, day sheet, person carousel, social calendar, 1:1 messaging, message + task reactions. Todo List view is implemented. Planned: Diary view and Notifications tab. Messaging/reactions are a Mosaic addition, not in the reference app (see §20).

**ARCHITECTURAL RULE:** every Category and Diary document carries a `visibility` field (`public`, `followers`, `private`). Appwrite RLS is avoided by server-mediated reads (`get_friend_calendar`) and server-mediated cross-user writes (`message-action`). See §6 and §20.

**Behavioral specs for planned views (governs Phase 3.5–3.7):**
- **Todo List view:** compact, color-only calendar grid. Clicking/tapping a day always selects it; no task titles appear on the grid. The compact month renders only the natural week rows required by that month (normally five, six only when spillover requires it); do not force a sixth week onto shorter months. The active month grid is horizontally centered inside its viewport, and neighboring carousel slides must not visually bleed into it. Selection is shown by a white circle around the day numeral only, not by filling the whole day cell. Each day reserves a fixed four-circle 2×2 completion marker: only categories with at least one completed task contribute color, ordered by the category `order` used by Day View and capped to the first four categories. One contributing category fills all four circles; two categories fill the top pair then bottom pair; three or four categories distribute deterministically in category order. No completed-category color yields the neutral marker. The marker overlays the number of incomplete tasks, or a check mark when the day has tasks and all are complete. Horizontal swipes that begin on the compact calendar grid use the same direct-manipulation behavior as the Calendar view: the month follows the finger smoothly, then snaps to the adjacent month, and the outer friend/person carousel MUST NOT advance. A non-swipe tap must remain a tap; keyboard arrow keys move/select the adjacent day (left/right) or week (up/down) without stealing arrows from editable fields. The selected-day task area reuses Day View inline. Owner mode keeps category/task editing; friend mode uses the same Todo surface and date navigation but is read-only for task data while retaining task reactions and reply/message actions. The Todo surface owns one cohesive vertical page scroll from compact calendar through all selected-day categories/tasks; the inline Day View MUST NOT create its own nested vertical task scroller. Horizontal day swipes inside this inline task area belong to the Todo List and MUST NOT advance the outer friend/person carousel; crossing a month boundary updates the displayed Todo month. The Day View navigation row places Previous day, a larger visible date header, and Next day on one line inside the horizontal day-swiper surface so a swipe beginning anywhere in that header area can navigate days, while vertical-dominant gestures hand off to the enclosing page scroller. The Todo surface and nested Day View swiper must stay width-bounded and horizontally centered so no page-level horizontal scrollbar appears.
- **Todo/Day View polish:** the Todo month grid is visually transparent, borderless, horizontally centered, and uses larger day numerals; it sits immediately above the selected-day Day View without extra bottom card padding or an external spacer before the Day View date header. Opening a category's add-task control places the new-task row immediately below that category pill and before existing tasks; the pending row already shows the task checkbox, the input underline/border uses the category color, and the pill's plus icon is intentionally larger than the prior 14px treatment. Owner Day View task rows render memo text inline rather than a generic memo indicator. Single-tapping memo text opens the memo in read mode; tapping the memo again inside that sheet enters edit mode. Double-tapping inline memo text opens the memo directly in edit mode. Double-tapping a task title enters inline title editing; triple-tapping a task title opens the memo editor. When triple-tap is enabled, it takes priority over double/single tap; swipe/drag still outranks taps.
- **Day View sheet interaction:** tapping the exposed backdrop closes a sheet. Phone full-height sheets leave a small backdrop strip so that dismissal target exists; tablet-and-larger full sheets may use the full dynamic viewport height. The entire exposed Day View sheet body is part of the horizontal day-swipe surface, including blank space below the final category/task; the native day Swiper must fill the sheet content height rather than ending at the last rendered category. The Day View date/navigation row is both part of that horizontal surface and an allowed vertical drag-to-close handle. Horizontal drags on the shared row are direct-manipulation Swiper gestures: the row visibly follows the finger before snapping. BottomSheet may claim the gesture only after movement is clearly vertical for drag-to-close; do not replace horizontal motion with a release-only sheet fallback. Unmodified ArrowLeft/ArrowRight mirror previous/next day unless focus is in an editable control.
- **Home task search:** the Home top bar places Search immediately beside the hamburger. Opening Search expands/focuses a Home-owned search field and keeps the user on Home; results appear in an overlay below the bar without reflowing the calendar. Search covers only the signed-in user's tasks and runs entirely over the existing local live task/category arrays—no Appwrite request, per-keystroke RxDB query, duplicate always-on task/category subscription, image fetch, or thumbnail decode is allowed. Title matching is case-insensitive; prefix matches rank before substring matches. Filters support multiple categories plus Any date, Today, This week, This month, and a custom start/end range. With no query or active filter the panel shows guidance instead of rendering all tasks; filters alone may return results. Future/today results sort chronologically before past results, which sort newest-first, and the rendered result list is bounded. Each result shows title, category/color, date, completion state, and lightweight memo/image presence icons. Selecting a result opens the existing owner Day View sheet at that date and focuses/highlights that task. Search query, filters, result scroll position, and expanded state remain mounted under Day View so browser/Android Back or downward Day View dismissal returns to the same search state; explicitly closing Search clears its state. Search/filter controls opt out of the Home→Explore gesture. Expansion/result motion must be transform/opacity/layout based, reduced-motion aware, and must not introduce per-frame React state.
- **Account/data controls:** sign-out actions remain in normal page flow rather than being pinned below a nested scroller. The Me page does not render a decorative quotation/author block. Its social stats label accepted relationships as **Friends** and read the count from the shared FriendsProvider; do not hard-code the count or add a second friendship subscription. “Delete All User Data” is a separate destructive action from “Clear Local Data”: after confirmation it removes/tombstones all Mosaic rows owned by the signed-in user across the six synced collections, hides/tombstones the profile, deletes referenced owned images on a best-effort basis, and then signs out/clears the local database. It does not delete the Appwrite login account itself.
- **Bottom navigation inset:** the global content inset reserves only the fixed bottom-navigation height plus the device safe-area inset; it must not create an extra dark spacer above the nav or obscure the final page content.
- **Primary page swipe navigation:** the five bottom-nav pages form a direct-manipulation horizontal route sequence Home → Explore → Alerts → Chat → Me. A valid horizontal swipe visibly drags the current route surface with the finger before completing navigation, and the destination page is visibly attached on the exposed side throughout the held drag; never reveal an empty shell/background between pages. Vertical scrolling remains native and nested horizontal owners keep priority. On Home, route navigation to Explore may begin only from the top hamburger/menu layer so the person/calendar carousels keep their existing horizontal gestures. Home's route-shell ancestry must preserve a definite full-height chain so the absolutely-sized friend/person swiper below the pill carousel cannot collapse. On every other primary page, MainLayout owns the vertical page scroll and the swipe owner covers the entire scrollable page content down to the bottom-navigation inset; primary page implementations must not add a nested full-page `overflow-y-auto` scroller that steals phone gestures. On Me, a leftward swipe opens Settings and a rightward swipe returns to Chat. Settings participates as the Me detail edge: a rightward swipe returns through browser history to Me when Settings was opened from Me, with a direct/deep-link fallback that replaces to Me, and a leftward swipe does nothing. Settings child pages use the same direct-manipulation surface as parent-aware details: Profile and Screen (`/settings/screen`) right-swipe back to Settings with the Settings page visibly attached under the drag, while left swipes do nothing. Their header Back controls use the same parent-history/fallback rule. Individual chat routes do not participate. The fixed bottom nav remains stationary while page content drags. Destination route chunks on both reachable sides are prefetched after first paint/idle. Do not mount hidden neighbor route trees during the initial critical render. Once a horizontal gesture locks to a direction, mount only that already-prefetched directional route inside the attached neighbor panel so the user sees real adjacent-page content under the finger; the lightweight route-specific shell remains the Suspense fallback if the chunk is not ready. The opposite neighbor stays unmounted. Route drag transforms remain compositor-owned and custom per-frame DOM writes are rAF-batched without React state updates on every move.
- **Appearance modes:** Settings → Screen exposes System, Dark, Light, and Black appearance modes. System follows `prefers-color-scheme` live; Dark preserves Mosaic's existing charcoal palette; Black uses true-black primary surfaces for OLED; Light uses a light neutral surface/text palette while preserving semantic/category/accent colors. The selected mode is applied immediately, cached locally before React bootstrap to avoid a flash on reload, and persisted through the synced settings collection for the signed-in user. Theme changes are palette-only and must not alter layout, spacing, typography, gesture geometry, or task/category colors.
- **Large-screen layout preferences:** Settings → Screen also owns Content width and Bottom sheets preferences. Content width offers Full screen, Comfortable, and Wide; Comfortable keeps phones full width and, from the tablet breakpoint upward, centers the entire primary route-swipe surface at `min(70vw, 960px)`, while Wide centers it at `85vw`, so the live current/destination drag geometry stays unified. Bottom sheets offer Full width and Compact; Compact keeps phones full width and centers the shared BottomSheet primitive at up to 540px on tablets and larger. Both preferences apply immediately, are cached before React bootstrap to avoid a stretched-width flash, and persist through the existing synced settings collection.
- **Orientation:** Mosaic no longer globally forces portrait in the PWA manifest. Tablet/large-screen installed contexts may rotate between portrait and landscape; phone portrait locking is best-effort through the Screen Orientation API where supported, because the web manifest has no standard device-size-conditional orientation value.

- **Diary view:** per-day free-text entry, keyed by `yyyy-MM-dd`. Visibility field per entry. Renders in the same view-switcher slot as Calendar.
- **Notifications tab:** in-app notifications for message and reaction events. Renders a full `<ComingSoon />` page until wired.
- **Calendar layout alignment (permanent):** Month and Week views must be perfectly vertically aligned — same header spacing, `auto-rows-fr` on grids. Switching Month → Week jumps to the week containing the 1st of that month. Week header renders "Aug 30 - Sep 5, 2026" on a single line. Task blocks fill the full grid-cell width with `px-1.5` margins, `rounded-[3px]` corners, and `overflow-hidden whitespace-nowrap` (NEVER truncate or `...`). Task image thumbnails inside Calendar task blocks span edge-to-edge across the block width; title padding must not inset the image. Completed tasks show category color; uncompleted are `bg-[#374151]` / `text-gray-400`. Saturdays `text-blue-500`, Sundays `text-red-500`, today has a blue circle border.

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
- **Local DB & Sync Engine:** RxDB v17 (`getRxStorageDexie` + `wrappedValidateAjvStorage`). **CRITICAL:** we do NOT use the `replicateAppwrite` plugin. Custom REST sync engine (`src/db/sync.ts`) calls the Appwrite TablesDB API directly.
- **Backend:** Appwrite TablesDB (SDK v26+).
- **Backend Functions:** `message-action` (Node.js 18) handles all cross-user writes for messaging and task reactions, and its trusted `x-appwrite-trigger: schedule` path performs 90-day tombstone garbage collection. Browser/user executions cannot select the maintenance path through an action payload. Actions are enumerated in §20.3; maintenance is specified in `docs/TOMBSTONE_RETENTION.md`. Required scopes remain `rows.read`, `rows.write`, `tables.read`. `tables.write` intentionally absent — add only if Appwrite docs/Console require it for cross-user `upsertRow`/`updateRow`.
- **PWA:** `vite-plugin-pwa` (`registerType: 'prompt'`), with passive registration
  and activation after all old controlled clients close; see §15 and §24.9.
- **Auth:** React Context (`AuthProvider`) is the single source of truth for the authenticated user. See §23. `useAuth` is a thin consumer shim; no hook mounts its own `account.get()`.

## 5. Portable AI Workflow Boundary

See [AI workflow](AI_WORKFLOW.md) for capability-based execution and checkpoints.

## 5.1 Full-file Revision Transport

See [offline implementation output](AI_WORKFLOW.md#offline-implementation-output).

## 6. Appwrite 2.0 Strict Guardrails (CRITICAL)
- **Regional Endpoint:** Must use the specific regional endpoint found in the project URL (e.g., `https://sgp.cloud.appwrite.io/v1`), NOT the generic `cloud.appwrite.io`
- **Use TablesDB, NOT Databases:** All SDK calls must use the TablesDB service (e.g., `tablesDB.upsertRow`, `tablesDB.updateRow`), not the deprecated Databases service
- **Permission String Format:** Use the new format: `create("any")`, `read("any")`, `update("any")`, `delete("any")`. The old `"role:any"` formats are deprecated
- **Row-Level vs Table-Level Permissions (VERIFIED):** `Permission.create()` **does NOT apply to rows**. Applying it to a row throws an error. Row-level permissions must only ever be `[read, update, delete]`. The **`create` permission belongs on the TABLE-level permissions** in the Appwrite Console (e.g., grant `create("users")` at the table level so authenticated users can insert new rows). If new-row sync fails with 401/403, the fix is in the Console, NOT in `buildRowPermissions`
- **`updateRow` vs `upsertRow` (CRITICAL, §0 item 4):** `upsertRow` is a **full replace (PUT semantics)** in Appwrite 2.0 — any column omitted from `data` is reset to its column default. `updateRow` is a **PATCH** — omitted columns are left untouched. The sync engine **must** use `updateRow` for rows that already exist remotely, and `createRow` for brand-new rows. Failing to do this caused `read_at` on outgoing messages to be wiped on every sync cycle. **Do NOT use `upsertRow` as a fallback for a 404 on `updateRow`** — `createRow` is a strict insert with no PUT semantics and is the correct choice.
- **Cross-User Writes Go Through Appwrite Functions (§0 item 7):** A user can only assign permissions they themselves hold. To write a row owned by another user (recipient's message copy, sender's task reaction, sender's read receipt), the write must be performed inside an Appwrite Function using its API key. Direct client writes to another user's row will 401/403 (see §20.3)
- **REST Endpoints:** Base path for tables is `/v1/tablesdb/{databaseId}/tables/{tableId}`
- **ID Mapping:** RxDB primary key `id` maps directly to Appwrite's `$id` column
- **Row ID Length Cap (CRITICAL, §0 item 3):** Appwrite `rowId` values must be **≤36 characters**, matching `[a-zA-Z0-9_]+`, and MUST NOT start with a leading underscore. Any locally-generated ID that will become a remote `rowId` (settings, diary, or deterministic composite IDs) must respect this limit. **Rule:** when building `${userId}_${key}` IDs, validate the total length; if it exceeds 36 chars, fall back to a deterministic hashed ID (see §11)
- **Session Management:** Appwrite sometimes auto-creates a session on signup. Always wrap `account.createEmailPasswordSession` in a `try/catch` during signup, and explicitly clear stale sessions (`account.deleteSession('current')`) before login to prevent "Session is already active" errors
- **`$sequence` Type Change:** In Appwrite 2.0, `$sequence` is now a `string` (was `int`). Currently unused in this codebase, but note it if you ever sort by sequence
- **`Parameters<T>` on SDK Methods Picks the Wrong Overload:** Appwrite's TablesDB/Storage/Functions methods are overloaded; TypeScript's built-in `Parameters<typeof method>` utility resolves to the **last** overload, which for these methods is a deprecated `(id: string, ...)` form. Never use `Parameters<>` to derive param types for these methods. Define the param shape explicitly in `src/lib/sdk.ts` and cast at the call boundary (`params as never`). See §15 for the guarded SDK surface.

## 7. UI/UX & Architectural Guardrails
- **Dynamic Colors:** Category colors MUST be applied via inline styles (`style={{ backgroundColor: cat.color }}`) — never dynamic Tailwind strings.
- **Predefined Colors Only:** Use the strict hex array in `src/constants/colors.ts` for `ColorPalettePicker`. No free-form hex inputs.
- **Bottom Sheet Standardization:** All modals MUST use `<BottomSheet>` (see §13). It MUST use `ReactDOM.createPortal` into `document.body` to escape parent z-index/overflow traps and sit above `BottomNav`. Drag-to-close is restricted to the header handle via Framer Motion `useDragControls` + `dragListener={false}` on the main container — prevents accidental closes while scrolling. On Android/Samsung browser or installed-PWA Back, open sheets are modal history layers: Back dismisses only the top sheet, repeated Back dismisses nested sheets top-first, and route/browser navigation resumes only after the sheet stack is empty.
- **Sticky Layout Rules:** `MainLayout` root must be `h-screen overflow-hidden`; `<main>` must be `flex-1 overflow-y-auto`. Without both, `position: sticky` misbehaves.
- **Non-Sticky Home Chrome:** On Home, the person carousel, profile header, `TopBar`, and calendar date header are intentionally NOT sticky — they scroll away so the calendar grid owns the viewport. Do not re-add `sticky top-0`.
- **Layout-Shift Reservation:** Any element whose visibility toggles (timestamps, status rows, hover controls) MUST always reserve its space — toggle opacity, never presence. Prevents the hover-flicker reflow loop.
- **Gesture Priority on Interactive Elements:** swipe > long-press > double-tap > single-tap. Single-tap is deferred ~300ms to distinguish from double-tap. Any tap on the same pointer sequence as a swipe or long-press MUST be suppressed via a flag on the gesture hook (see §21).
- **Nested Carousel Gesture Ownership:** horizontal swipes that begin inside the calendar carousel belong to the calendar and MUST NOT advance the outer friend/person carousel. Horizontal swipes outside the calendar may advance the friend/person carousel. Parent isolation must not cancel the child calendar's own pointer lifecycle.
- **RxDB Reserved Keywords:** NEVER use `deleted` as a field name in RxDB schemas (see §12).
- **Soft Deletes:** Synchronized deletes are represented by `isDeleted: true` tombstones. Tombstones are retained for 90 days by default; clients with an older incremental cursor perform a full pull, and the privileged tombstone GC may permanently delete tombstones older than the retention window. See `docs/TOMBSTONE_RETENTION.md`.
- **Strict ISO Dates:** All date fields MUST be ISO 8601 strings (`yyyy-MM-dd` for day keys, full `.toISOString()` for timestamps).
- **iOS Storage:** Must call `navigator.storage.persist()` on launch to prevent WebKit from purging IndexedDB.
- **Coming Soon:** Bottom nav has 5 tabs: Home, Explore, Notifications, Messages, Account. Notifications renders a full `<ComingSoon />` page.

## 8. Current Progress & State

See [roadmap](PLAN.md) for delivered work and backlog, [checkpoint](SESSION_STATE.md)
for the active task, and [test workflow](TEST_WORKFLOW.md) for verification commands.

## 9. Hook & State Conventions
- **Named return object, never array:** `{ <domain>, isLoading, ...mutators }`; mutators `useCallback`-wrapped.
- **User-scoped data guard:** any hook reading user data tracks `loadedUserId`; expose data only when it matches, else `[]` + `isLoading = true`. Prevents cross-user leakage during logout/login.
- **Depend on `user?.$id`, never the `user` object** — Appwrite object identity churn causes re-subscription storms.
- **Observable subscriptions:** RxDB reads use `query.$.subscribe(...)` in a `useEffect`, store + unsubscribe in cleanup, guard `setState` with `isMounted`.
- **Mutator signatures:** Add = `Omit<Doc, 'id'|'userId'|'createdAt'|'updatedAt'|'isDeleted'>`; Update = `(id, updates: Partial<Doc>)`; both `useCallback` with `user?.$id` in deps.
- **"Sync State From Props" pattern:** render-body reset — `const [syncedId, setSyncedId] = useState<string|null>(null); if (task?.id !== syncedId) { setSyncedId(task?.id ?? null); setEditedValue(null); } const value = editedValue ?? task?.field ?? '';`. Canonical replacement for useEffect-based prop-syncing (MemoSheet, DatePickerSheet, EditTaskSheet, DayViewSheet).
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
- **Permanent-failure drop policy (Social Outbox):** `src/lib/socialOutbox.ts` drops after 5 attempts or on a permanent failure (401, or any non-429 4xx). On drop it emits a `SocialOutboxFailureEvent` to `subscribeToSocialOutboxFailures` listeners; `FriendsProvider` reverts the matching local RxDB row; `ExploreView` surfaces the existing toast pattern. Never silently drop — every drop MUST be accompanied by a local revert and (when the originating UI is mounted) a toast.
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
  - `updatedAt` (local) ↔ `updated_at` (remote) — every synced collection participating in the `usesTimestamps` pull-winner predicate has it. `categories` and `settings` gained it in the 2026-09-16 D6 migration (see Changelog; migration script `scripts/add-categories-settings-updated-at-columns.mjs`).
- **`messages` field mapping:** `threadId`→`thread_id`; `senderId`→`sender_id`; `recipientId`→`recipient_id`; `direction`→`direction`; `taskRefId`→`task_ref_id`; `taskRefTitle`→`task_ref_title`; `taskRefDate`→`task_ref_date`; `taskRefColor`→`task_ref_color`; `replyToId`→`reply_to_id`; `replyToContent`→`reply_to_content`; `replyToSenderId`→`reply_to_sender_id`; `isUnsent`→`is_unsent`; `originalMessageId`→`original_message_id`; `reactions`→`reactions`; `readAt`→`read_at`; `deliveryStatus`→`delivery_status`.
- **`read_at` is server-owned on outgoing rows (§0 item 5):** `toAppwriteFormat` for `messages` MUST omit `read_at` when `direction === 'outgoing'` — the client would overwrite the `mark_read` receipt. Applies only to `messages`. On pull, the server-owned `read_at` on an outgoing row is applied BEFORE the dirty-skip so a locally-dirty outgoing message still receives the receipt.
- **Date storage:** day keys `yyyy-MM-dd` via `date-fns.format`; timestamps full ISO 8601 via `.toISOString()`. Compare timestamps with the `toMs()` helper (`Number.isFinite` guard).
- **Empty-string over null:** optional string fields (`memo`, `image`, `completedAt`, `icon`, `friendBio`, `threadId`, `replyToId`, `replyToContent`, `replyToSenderId`, `originalMessageId`, `reactions`, `readAt`, `updatedAt`) default to `''` — never `null`/`undefined` — so RxDB validation never fails.
- **Reactions format:** JSON string of `Array<{ emoji: string; userIds: string[] }>`. Serialized as `''` when empty (not `'[]'`). Parse/stringify only via `src/lib/reactionUtils.ts`.
- **Schema migrations:** adding an optional field to an existing RxDB collection requires (1) bump schema `version`, (2) add a `migrationStrategies` entry in `database.ts` backfilling `''` (or `false` for booleans), (3) update both `toAppwriteFormat` and `fromAppwriteFormat`, (4) update `KNOWN_FIELDS` (drift detection), (5) run a one-off `scripts/*.mjs` to add the Appwrite column. `tests/helpers/testDb.ts` mirrors `database.ts`'s strategies and MUST be updated in lock-step — see §24.5. Any non-RxDB mapper constructing the same doc type (e.g. `friendData.mapCategoryRow`) MUST be updated in the same patch or the build fails on the missing required field.

## 13. Modal & Bottom Sheet Structure
- **One sheet = one file.** Props `{ isOpen, onClose, <entity>, onSave/onConfirm }`. No context-based orchestration. Primitive rules: §7.
- **Nested sheet choreography:** when one sheet opens another (TaskActionSheet → MemoSheet), parent passes `isLocked={isBackgroundLocked}` down. `isBackgroundLocked` is a single boolean OR of all child-sheet open states.
- **Action sheets close themselves before opening a sibling:** `onClick={() => { onX(); onClose(); }}` — the action sheet must visually dismiss first.
- **Sheet content padding:** `pt-2 pb-8 px-4` (or `px-1` for full-width lists). No extra wrappers.
- **Delete confirmations:** destructive flows open a nested `BottomSheet` with `isLocked={true}` and a two-button `[Cancel | Delete]` row (`bg-[#2A2A2A]` / `bg-red-500`). `window.confirm` is BANNED in sheets. References: DayViewSheet "Delete Photo", CategoryManagerSheet "Delete Category", ChatPage "Unsend Message".
- **Deleting state:** nested delete-confirm sheets track local `isDeleting` and render a spinner inside the Delete button while in flight.
- **Reorderable sheets:** Framer Motion `Reorder.Group`/`Reorder.Item` with `dragListener={false}` on the item and a dedicated grip handle calling `dragControls.start(e)`. Never whole-row drag in a scrollable sheet.

## 14. Component Conventions
- **Named exports only** (`export const Foo: React.FC<Props> = ...`); default export only for `App.tsx`.
- **Props interface above component:** `interface XxxProps { ... }` immediately above; never inline.
- **Memo + displayName:** any `React.memo` component MUST set `.displayName`.
- **Prop callbacks:** internal handlers `handleX` (useCallback if passed to children or used in effect deps); external props `onX`.
- **Stop event leakage in lists:** buttons/inputs inside tappable rows MUST `onPointerDown={(e) => e.stopPropagation()}` — critical inside Swiper slides and message bubbles.
- **Animation tokens:** entry via `animate-in fade-in duration-300` or `animate-in fade-in slide-in-from-<dir>-1 duration-200`; Framer Motion `whileTap={{ scale: 0.95–0.98 }}` on all tappables.
- **Spinner primitive:** ALWAYS `<div className="w-N h-N border-2 border-white border-t-transparent rounded-full animate-spin" />`. No SVG/library spinners.
- **Unified gesture hooks:** any element supporting >1 gesture (swipe + tap + long-press) MUST use a single state-machine hook (`useBubbleGestures`). Do not stack hooks. Refs hold internal gesture state; only `swipeOffset`/`isSwiping` use React state, throttled with `requestAnimationFrame`.
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


## 17. Native Input Quirks
- **Theme-aware native controls:** date and other native form controls inherit Mosaic’s resolved color scheme (`light` in Light; `dark` in Dark/Black/System-dark). Do not hard-code `[color-scheme:dark]` now that appearance is selectable.
- **Focus management:** focus sheets/inline inputs via `useRef` + `useEffect` on `[isOpen, taskId]`. NEVER `autoFocus` — Safari/iOS ignores it inside conditionally-rendered subtrees (any AnimatePresence-wrapped BottomSheet).
- **File input reset:** after an `<input type="file">` upload (success OR failure), reset `fileInputRef.current.value = ''` so the same file can be re-selected.
- **Body scroll lock:** BottomSheet is the only component allowed to touch `document.body.style.overflow`; it uses a module-level `openSheetCount` counter for nested sheets.
- **`touch-action: pan-y` on gesture-enabled elements:** any element owning horizontal gesture handlers MUST set `touchAction: 'pan-y'` inline, else iOS Safari interprets the swipe as back-navigation and suppresses vertical scroll.

## 18. Async & Race Safety
- **Cancellation ref:** every async `useEffect` has a local `let isMounted = true` flag checked before `setState` in every continuation; cleanup sets it false.
- **Programmatic-move guards:** set `isProgrammaticMoveRef.current = true` before `.slideTo()`/`.scrollTo()`, clear in a `requestAnimationFrame`; handlers check the ref to ignore self-induced events — prevents infinite feedback loops.
- **Re-entrancy guards:** sync/network loops use a module-level boolean (`isSyncInProgress`, `isDeliveryInProgress`) and log-and-return on re-entry.
- **Bounded loops:** any externally re-enterable loop has an iteration cap. `deliverPendingMessages` caps at 5 and logs `[messageDelivery] delivery loop hit cap (5); breaking`; remaining rows stay pending until the next trigger.
- **Attempt-once ref:** lazy side effects that should run once per entity (friend bio backfill) use a `useRef<Set<string>>` of attempted IDs.
- **Fire-and-forget cross-user writes:** `mark_read`, `unsend`, `react`, `react_to_task` are dispatched without awaiting. Errors log but never throw. `mark_read`/`unsend` enqueue into `messageActionQueue` on transient failure; `react`/`react_to_task` do not (they have optimistic-revert + user feedback; silent retry would desync). `deliver` retries via the pending outbox.
- **Polling in long-lived screens:** `ChatPage` runs a 30s `forceSync()` interval while the tab is visible, skipping when `document.visibilityState !== 'visible'` or `navigator.onLine === false`. Cleared on unmount.
- **Auto-scroll pinning:** chat lists track `isPinnedToBottomRef` updated synchronously in the scroll handler. Incoming auto-scrolls only when pinned; outgoing always scrolls. FAB reflects un-pinned state.
- **`queueMicrotask` for effect-triggered async:** wrap the kickoff in `queueMicrotask(() => { ... })` and re-check `isMountedRef.current` inside; the async function itself must be async-first (all setState after the first `await`).
- **Local-dirty-wins conflict semantics:** when a locally-modified row (`_meta.lwt` newer than last sync) conflicts with a remote tombstone, the client keeps its local version and re-pushes next cycle. Deliberate: local edits are user intent that outranks a stale server deletion. Trade-off: device B's unsynced edit can resurrect a row deleted on device A. Remote-wins was rejected (silent data loss for offline edits). Policy is global, no per-collection override.
- **Two-phase read-then-write for multi-row server mutations:** when an Appwrite Function writes to >1 row in one action (`handleReact`), structure as two passes. **Pass A** reads + computes next values for every target, validating each (`REACTIONS_MAX_LEN` overflow check). **Pass B** writes. Any Pass A validation failure returns 400/403 before ANY write — prevents one-row-succeeded / one-row-overflowed partial commits. Residual risk: a Pass B failure after the first write partially commits; next sync reconciles. Known limitation (§20.7).
- **Mounted pane freshness:** any component displaying cached data from an externally-changeable source that stays mounted across navigation MUST refetch on activation, throttled by a minimum interval. Reference: `PersonPane` friend-pane activation (`FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`). Own-user panes are exempt if they subscribe live via RxDB. Do not rely on cache TTL alone.

### Accepted Sync Engine Limitations

These are documented, deliberate trade-offs after the sync-engine audit. Each was considered for a fix and rejected. Do not "fix" them without revisiting the reasoning below and the risk profile that produced the decision.

- **D1 — Concurrent same-row edits are last-write-wins.** Two devices editing the same row within one sync cycle: the later `updateRow` overwrites the earlier writer's fields. Push has no etag, version column, or compare-and-set. Rejected alternatives: (a) an `updatedAt`-conditional write depends on TablesDB supporting filter-based conditional updates, which was not verified against the live API; (b) a `version` integer column per table requires a schema bump, an Appwrite migration, and a mapper change across every collection; (c) an Appwrite function-mediated CAS reintroduces the same failure modes the sync engine already handles, at higher complexity. For a personal life tracker where the typical case is one device online at a time, the failure is rare. Revisit if the app ever adds real-time collaboration or multi-device active editing.
- **D3 — Clock-skew tolerance is `PULL_OVERLAP_MS = 30_000`.** The only guard against client-versus-server clock drift. A client clock ahead of the server by more than 30s can skip remote rows permanently, because the pull query's `$updatedAt > sinceIso` filter excludes them and cursor pagination does not re-fetch them after the overlap window passes. Rejected alternatives: fetching server time and applying an offset introduces a new failure mode on login (the offset fetch itself can fail or be skewed by a slow network), and a wider overlap window increases duplicate pulls proportionally. Accepted as a documented constraint; a device with a badly wrong clock will not sync correctly, but modern device clocks are within seconds of truth. If a user reports missing rows after a device clock change, widen the window and revisit this decision.
- **D7 — Cold sync treats all local rows as dirty.** If `localStorage` is cleared while IndexedDB survives (partial site-data clear, or a manual developer action), `loadPerCollectionState` returns `{}`, both `pullBoundaryMs` and `dirtyBoundaryMs` are 0, every local row satisfies `localLwt > 0`, and the next sync pushes every local row. Rejected alternatives: (a) skipping the push for one cycle is ineffective — the next cycle sees `dirtyBoundaryMs` still `''` and pushes anyway; (b) overriding `dirtyBoundaryMs` to `cycleStartMs` breaks the push of local-only rows (they have no `remoteMeta`, so the non-dirty push predicate never fires) and regresses `categories`/`settings` push (they now participate in `usesTimestamps` post-D6, but only if their `updatedAt` is meaningful — a migrated row with `updatedAt: ''` would be skipped); (c) persisting per-collection state to IndexedDB requires a new persistence layer, which is out of scope for an isolated fix. The current behavior — push local state, last-write-wins — is arguably correct for a local-first app: the user's local data is their data, and pushing it back is the local-first stance. Revisit only if a user reports data loss from a partial storage clear.
- **F9-backoff — Sync backoff state is per-tab.** `rateLimitUntil`, `rateLimitBackoffMs`, `failureBackoffUntil`, and `failureBackoffMs` are module-level state, not cross-tab. Two tabs can each accumulate their own backoff and hit the endpoint independently. Web Locks serializes cycles but does not share backoff. Rejected fix: persisting backoff state to localStorage adds a new persisted key, cross-tab read/write coordination, and edge cases around clock changes. Accepted; the risk is a rate-limit stampede in a multi-tab session, bounded by the sync engine's page cap and per-collection error isolation to non-catastrophic.
- **Social Outbox — no server-side compensation on drop.** When a social outbox entry is dropped (5 attempts exhausted, or a permanent 4xx), the local row is reverted but the remote side may be partially written (e.g. the outbox succeeded in creating the friend's reciprocal row on a previous attempt but the local revert fires on a later permanent failure of a different row). Because both writes in a friendship pair are independent single-row calls, the reconciliation window is bounded to the next sync cycle and the local row is authoritative. A transactional two-row write would require an Appwrite Function and is out of scope for this batch.

## 19. Bootstrap & Persistence
1. `main.tsx` order: `navigator.storage.persist()` → `initializeDatabase()` → fire-and-forget `initializeSync()` and a lazy image-cache budget sweep → `ReactDOM.createRoot(...).render(<React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>)`. Neither background operation blocks render.
2. Initial sync and image-cache sweep are always rejection-handled — either failure must never prevent mount.
3. Auth resolution happens in `AuthProvider`, not `main.tsx`: single `account.get()` on mount (deferred via `queueMicrotask`), broadcast via context.
4. Login-triggered sync: because cold-load `initializeSync()` may run before any session exists, `AuthPage.handleSubmit` calls `initializeSync()` after a successful `login`/`signup` and before navigating to `/home`.
5. `ignoreDuplicate: true` on `createRxDatabase` + a singleton `dbInstance` module variable are required for React StrictMode double-invocations.
6. Data hooks opportunistically purge known-bad local state (oversized row IDs, legacy composite IDs) during init, before subscribing.
7. In production a cold authenticated load fires exactly one `account.get()` (from `AuthProvider`); in dev with StrictMode it fires twice — expected. If you see more, an auth source leaked back into a consumer. Verify with `console.count('account.get')`.

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
Single function, single ID, `action` field in the body. Six actions:

| Action | Caller | Purpose |
|---|---|---|
| `deliver` | sender | Create the recipient's row via API key with recipient-owned permissions. Rejects `messageId` not starting with `msg_`, and messages with no content, no task ref, and no reply target (`Message has no content`) |
| `mark_read` | recipient | Patch `read_at` on sender's outgoing rows (`WHERE user_id = sender AND thread_id = X AND direction = 'outgoing' AND read_at = ''`). Response: `{ ok: true, markedPartner, markedCaller }` |
| `unsend` | sender | Patch BOTH rows: wipe content/refs/reactions, set `is_unsent=true`. Cascade-wipes `reply_to_content` on any messages that quoted the unsent message |
| `react` | either | Read-modify-write reactions on BOTH rows using two-phase read-then-write (overflow pre-check on both rows before any write — see §18 and §20.7). Legacy incoming-row backfill: see §22 |
| `react_to_task` | friend of task owner | Patch the task owner's task row with a reaction delta |
| `get_friend_calendar` | friend of calendar owner | Read the owner's visible tasks and categories (filters by `visibility`; verifies friendship) |

Function ID lives in `src/lib/messageDelivery.ts` as `MESSAGE_ACTION_FUNCTION_ID`. All actions live in `appwrite-functions/message-action/main.js`. Friendship is verified before every write. (General cross-user-write rule: §6.)

### 20.4 Delivery Flow
1. Sender inserts local message with `deliveryStatus: 'pending'`
2. `deliverPendingMessages(userId)` scans for pending outgoing rows
3. Each is sent to `message-action` with `action: 'deliver'`
4. On success: local row patched to `deliveryStatus: 'delivered'`
5. Re-entrancy guarded by module-level `isDeliveryInProgress`; outer loop capped at 5 iterations (§18)
6. Triggered on `AppLayout` mount, `window.focus`, `window.online`, and after every send
7. Each trigger also best-effort flushes the `messageActionQueue` (§20.5)

### 20.5 Read Receipt & Unsend Retry Flow
1. Recipient opens `ChatPage`, patches their incoming rows' `readAt` locally (drives unread badge)
2. Calls `markReadOnRemote(userId, partnerId, threadId)` → server patches sender's outgoing rows
3. On transient failure (429, 5xx, network), `markReadOnRemote` enqueues a `mark_read` entry into `messageActionQueue` (dedup key `mark_read:${threadId}`). On success or permanent failure, no entry is enqueued
4. Sender's polling `forceSync()` in `ChatPage` pulls the update
5. `MessageBubble` renders "✓✓ Seen at [time]" under the last read outgoing message

Unsend follows the same pattern: `unsendOnRemote(userId, messageId, recipientId)` enqueues on transient failure (dedup key `unsend:${messageId}`). Both entries are retried by `flushMessageActionQueue`, which runs on every `deliverPendingMessages` trigger. Attempts cap at 5; on exhaustion the entry is dropped and a warning logged.

The polling exists because the sync engine skips the pull phase for rows whose local `_meta.lwt` is newer than the last sync. Two poll cycles is the floor for a read receipt to round-trip without a targeted sync path. Read-receipt cadence is approximately 90–120s worst-case under backoff (30s `ChatPage` poll interval + up to 60s sync backoff cap).

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
- **Auto-scroll pinning:** `ChatPage` tracks `isPinnedToBottomRef`, updated synchronously in the scroll handler. Incoming auto-scrolls only when pinned; outgoing always scrolls. Scrolling back down sets the flag true.
- **Scroll-to-bottom FAB:** appears when scrolled >300px from bottom. Green dot indicates unacknowledged messages below. Hidden during search.
- **Search:** local-only, no server round-trip. `Cmd/Ctrl+F` or `Cmd/Ctrl+K` opens; `Esc` or X closes. Filters bubble content, task refs, reply quotes. Match counter `N/M`. Date dividers and gap-timestamps hidden while searching. Auto-scroll on new messages suppressed during search.
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
  login: (email, password) => Promise<boolean>;
  signup: (email, password, name) => Promise<boolean>;
  logout: () => Promise<boolean>;
  updateEmail: (newEmail, password) => Promise<boolean>;
  updatePassword: (newPassword, oldPassword) => Promise<boolean>;
  retry: () => Promise<void>;
}
```

### 23.3 Session Transitions
- **Mount:** `AuthProvider` defers `account.get()` via `queueMicrotask` inside its mount effect. On 401 → `user: null`, `isOffline: false`. On network error → `user: null`, `isOffline: true`, error message set
- **Login:** clears any stale session, creates a new one, calls `account.get()`, updates state, broadcasts a `login` event via `localStorage`
- **Signup:** same as login after account creation (with the `already active` / `prohibited` swallow for Appwrite's auto-session quirk)
- **Logout:** deletes the session, updates state, broadcasts a `logout` event. Returns `true` on success and `false` on failure. **Callers must gate navigation on the return value**
- **Update email / password:** these do not change session identity; they refresh `user` only

### 23.4 Mid-Session 401 Handling
- Every SDK call that can 401 goes through `guardedCall` from `src/lib/authEvents.ts`. In practice this means every consumer call routes through the guarded SDK surface (`guardedTablesDB`, `guardedStorage`, `guardedFunctions`, `guardedAccount` — see §15). Do not construct raw `TablesDB`/`Storage`/`Functions`/`Account` outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`; ESLint `no-restricted-imports` blocks it
- Raw `fetch` calls that can 401 (image blob fetches in `storage.ts` and `exportData.ts`) wrap their `fetch` in an outer `guardedCall` and throw `makeUnauthorizedError()` on `r.status === 401`
- `guardedFunctions.createExecution` normalizes `execution.responseStatusCode === 401` into `makeUnauthorizedError()` before returning — the SDK does not throw on 401 executions, so this step is required for global dispatch to fire
- On `isUnauthorizedError(err) === true`, `guardedCall` calls `dispatchUnauthorized()`, firing the window event `auth:unauthorized`
- `AuthProvider` listens for `auth:unauthorized` and clears `user`, sets a session-expired error, and lets `AppLayout` redirect to `/login` via its existing `!user` branch
- `src/lib/friendData.ts` additionally throws `FriendAccessError('Unauthorized', 'forbidden')` with `code = 401` on 401 — `guardedCall` keys off `code`; the friend-calendar UI keys off `errorKind === 'forbidden'` and renders "No access". Dual-purpose is intentional
- Do not redirect from the call site. Always dispatch and let the provider drive the redirect

### 23.5 Multi-Tab Auth Sync
- Login and logout both write `JSON.stringify({ type: 'login' | 'logout', at: Date.now() })` to `localStorage` under `mosaic_auth_broadcast`
- Every other tab listens via the `storage` event. On `logout`, it clears local user state. On `login`, it re-runs `resolveInitialUser()` to pick up the shared Appwrite cookie
- Never broadcast tokens or credentials — only the event type
- Not a replacement for server-side session invalidation; it is a UI consistency mechanism

### 23.6 Offline vs Unauthenticated
- **401 from `account.get()`** → definitely not logged in → clear user → `AppLayout` redirects to `/login`
- **Network error / timeout / offline from `account.get()`** → couldn't check → set `isOffline: true`, keep `user: null` → `AppLayout` renders a retry screen (with a `retry()` button) instead of redirecting
- **Any time `navigator.onLine` is false**, `AuthProvider` treats the initial check as "couldn't check"
- `AppLayout` renders three states: `isLoading` → spinner; `!user && isOffline` → retry screen; `!user` → redirect
- The `OfflineError` class in `src/lib/authEvents.ts` is the canonical "couldn't check" signal at the SDK-wrapper layer. `storage.getCurrentUserId` returns `null` for a confirmed 401 but throws `OfflineError` for anything else, so `uploadImage` can distinguish "you're offline" from "no authenticated user" (§10)
- **Offline auth gate (H1 = Option A, shipped in Phase 2 batch 2.1).** On mount-time network error, `AuthProvider` hydrates `user` from a persisted last-known identity, sets `isOffline: true`, and `AppLayout` renders the app tree with the offline banner. Cache is cleared on explicit `logout()` and on confirmed 401 — never on a network error. Network errors throw `OfflineError` and never dispatch `auth:unauthorized`, so the hydrated `user` will not trip the redirect path. Every consumer treating `user` as proof-of-live-session must be audited when this lands.

### 23.7 Things Not To Do
- Do not add `account.get()` calls to a hook or component. If you need session state, call `useAuth()`
- Do not call `account.deleteSession` outside `AuthProvider`'s `logout()` except for the pre-login cleanup inside `login()`
- Do not navigate away from a protected screen on `logout()` failure. Surface an error and stay put
- Do not merge `authContext.ts` into `AuthProvider.tsx` — it breaks fast refresh
- Do not treat offline errors as 401. The whole point of `isOffline` is that they're different
- Do not import `TablesDB`, `Storage`, `Functions`, or `Account` from `'appwrite'` outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`. ESLint rejects it, and it defeats the guarded surface

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
Injects a mocked `node-appwrite` module into `require.cache` via `createRequire`, then `require`s the real `appwrite-functions/message-action/main.js`. The mock provides `Client`, `TablesDB`, `Query`, `Permission`, and `Role`. `makeMockDb()` returns four `vi.fn()` spies (`listRows`, `getRow`, `upsertRow`, `updateRow`); each test queues specific `mockResolvedValueOnce`/`mockRejectedValueOnce` responses per call. `invoke({ userId, body, mockDb })` constructs a synthetic `req` (with the `x-appwrite-user-id` header) and captures `res.json` calls to return `{ body, status, logs, errors }`. Every handler action is tested end-to-end without a live Appwrite.

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
- Sync engine → `tests/unit/sync.test.ts`. The module has module-level state; each test uses `vi.resetModules()` in `beforeEach` followed by a dynamic `await import('../../src/db/sync')`. `guardedTablesDB` and `guardedAccount` are mocked with `vi.hoisted` spies. Per-collection state assertions read `localStorageMock.getItem('lastSyncTimePerCollection')`.

### 24.8 Regression comments
Tests pinning behavior documented here carry a `// Regression: §<section> (<contract name>)` comment. Examples: `// Regression: §20.5 (unread badge contract)`, `// Regression: §10 (CONFLICT Is Not an Error)`, `// Regression: §16 (conversation list sort)`. When the referenced section changes, review the test — the comment is a pointer, not enforcement.

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
`virtual:pwa-register`. App-version updates are independent of RxDB/Appwrite data sync: `forceSync()` does not check the service worker. Settings exposes the app release version and deployment build identity plus **Check for Updates** above the destructive data controls. The current release is **0.1.0**. Release-version and build-identity rules live in `docs/VERSIONING.md`. Manual checks call `ServiceWorkerRegistration.update()` and show progressive user-visible stages (preparing the service-worker check, checking the server, update found/downloading when applicable, ready to install, current, unavailable, or failure) rather than a generic “Checking…” label. The registration captured from vite-plugin-pwa is the fast path; if that callback does not provide a registration, the manual check first uses the standard `navigator.serviceWorker.getRegistration()` lookup and then, for an already-controlled page, the standard `navigator.serviceWorker.ready` registration before deciding that update checking is unavailable. This keeps the path browser-family-neutral (Chromium, Firefox, and WebKit/Safari) and avoids user-agent sniffing. An already-waiting worker immediately re-surfaces the update prompt, while a completed check with no waiting update reports that Mosaic is current. `PwaPrompt` gives waiting updates priority over installation.
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
generated service-worker policy pass. The guard reads the emitted module entry from
`index.html`, totals every emitted JavaScript/CSS asset, and totals unique precache files
from the generated worker. It enforces raw and Node-gzip entry/aggregate values plus the
unique raw precache value in `config/build-size-budget.json`.

These are regression ceilings with about five percent reviewed headroom over the
2026-09-20 baseline, not performance goals. Hashed output names are intentionally ignored.
A budget failure requires graph inspection and either a size fix or a documented decision
to accept the growth before changing the baseline/limit. Never raise a threshold solely
to make verification pass. `npm run build:size` checks an existing `dist/`; the diagnostic
`scripts/audit-bundle.mjs` remains the source for static-closure and package attribution.
The current baseline and limits live in `config/build-size-budget.json`; historical audit details remain available in Git history.


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
three credentials alone do not activate upload; optional source-map delivery must never
make an otherwise valid Preview/production build depend on stale external credentials.
Opted-in builds use hidden source maps and request deletion after a successful upload;
ordinary builds create no source maps for this integration. Client configuration continues
to use only `VITE_POSTHOG_TOKEN` and `VITE_POSTHOG_HOST`. The host is never assumed.

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
the existing seven-slide expensive render window. Calendar preserves its 61-slide Embla
geometry while limiting vertical scrolling to the rendered three-slide window. A CI-hosted
Chromium performance probe exercises a heavy fixture and reports requestAnimationFrame
timing plus PerformanceObserver long tasks without enforcing a budget. The 2026-09-25
baseline recorded approximately 60 FPS for calendar month swipe, day swipe, and heavy
day-content scroll; bottom-sheet open had one 64ms long task and a small 1.45% frame-over-
20ms ratio. These runner measurements are diagnostic baselines, not device guarantees.
No additional BottomSheet animation/CSS change is justified without a device trace or
stronger production-equivalent evidence.

## 25. Workflow Portability and History

[AI workflow](AI_WORKFLOW.md) owns the current process. Historical decisions are in
Git retains the historical project decisions and earlier instruction versions.
