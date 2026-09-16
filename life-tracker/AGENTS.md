# PROJECT_CONTEXT.md

## 1. The Vision
- An offline-first, local-first, self-hostable "Life Tracker" PWA
- **Phase 1:** A pixel-perfect, highly polished clone of "Todo Mate" (tasks, categories, social calendar, diary) to replace an ad-filled app
- **Phase 2:** Optional, modular integrations for fitness, media, and personal CRM
- **Phase 3 (extension beyond Todo Mate):** 1:1 messaging with friends, message reactions, and task reactions — a native social layer woven into the calendar
- **Core UX:** A unified, dark-mode calendar view that aggregates all life data, featuring 0ms load times (via RxDB), bottom-sheet interactions, and 100% offline functionality. Cloud is strictly for background sync

## 2. Product Reference: The "Todo Mate" Clone (Phase 1)
- **Dark Mode Aesthetic:** Clean, dark UI (`bg-[#111111]` / `bg-[#1E1E1E]`) with high-contrast, user-defined colors for categories
- **The Home Page & View Switcher:** Top-left button toggles between three sub-views: Calendar, Todo List, and Diary. (Todo List and Diary are planned; only Calendar is wired today.) The app must remember the user's last selected view (via localStorage or RxDB settings)
- **Person Carousel (Home):** A horizontal pill row at the top of Home switches between the user's own calendar and friends' calendars. First pill is always "Me"; friends follow (default alphabetical, user-reorderable, hideable). A double-person icon at the end opens the friends-preference sheet. Tapping a pill slides the calendar in the direction of travel and highlights the active pill. The profile header (avatar + name + bio) sits below the carousel and applies to **every** person, including Me. Horizontal swipe on the top zone (carousel row is scrollable independently, everything else above the calendar body) switches persons. Calendar resets to today on person change
- **Calendar View (Refined):**
  - Supports Month and Week views
  - Task blocks fill the entire horizontal space of the grid cell with minimal margins (`px-1.5`), subtle rounded corners (`rounded-[3px]`), and natural text cutoff (use `overflow-hidden whitespace-nowrap`, NEVER truncate or `...`)
  - Completed tasks show the category color; uncompleted tasks are greyed out (`bg-[#374151]`, `text-gray-400`)
  - Day numbers are centered. Saturdays are blue (`text-blue-500`), Sundays are red (`text-red-500`). Today has a blue circle border
  - Month and Week views must be perfectly vertically aligned (same header spacing, `auto-rows-fr` on grids)
  - Switching from Month to Week view jumps to the week containing the 1st of that month. Week view header shows "Aug 30 - Sep 5, 2026" on a single line
- **Todo List View:** Compact, color-only calendar grid. Clicking a colored dot "selects" that day. Scrolling down reveals a vertical list of tasks for the selected day
- **Bottom Sheet Interactions:** Tapping a day in Calendar view slides up a `DayViewSheet` showing tasks grouped by category, with an inline "Add Task" input at the bottom of each category section
- **Task & Category Management:** Categories are customizable (rename, predefined color picker, visibility toggles). Tasks can have memos and compressed image attachments
- **The Social Aspect:** Users can view friends' calendars. **ARCHITECTURAL RULE:** To avoid Appwrite's complex RLS, we "fake" this. Every Category and Diary document will have a `visibility` field (public, followers, private)
- **Messaging (Phase 3 extension, not in Todo Mate):** A native chat layer with friends, plus task reactions — see §20-22. This is a Mosaic addition, not part of the reference app.

## 3. Strict Constraints
- **Budget:** $0 for AI tools. $0 for Apple (relying on PWA "Add to Home Screen"). $25 one-time for Google Play (later)
- **Hosting:** Free managed cloud initially (Appwrite Singapore), easily self-hostable on a home NAS via Docker later
- **Performance:** Must load instantly (0ms) and work 100% offline
- **Mobile PWA Testing:** Local IP testing often fails due to Appwrite CORS and mobile OS SSL restrictions for background Service Worker API calls. Always use Cloudflare Tunnels (`cloudflared tunnel --url http://localhost:5173`) for reliable mobile testing, and whitelist the tunnel URL in Appwrite Platforms

## 4. The Locked Tech Stack
- **Frontend:** Vite + React 19 (TS) + React Router v7 + Tailwind CSS v3 + lucide-react + date-fns
- **Media & UI:** `browser-image-compression` (max 150KB base64), `emoji-picker-react` (used by message + task emoji pickers)
- **Local DB & Sync Engine:** RxDB v17 (using `getRxStorageDexie` and `wrappedValidateAjvStorage`)
  - **CRITICAL:** We do NOT use the `replicateAppwrite` plugin. We use a custom REST-based sync engine (`src/db/sync.ts`) that directly calls the Appwrite TablesDB API via `fetch`
- **Backend:** Appwrite TablesDB (SDK v26+), which provides a relational model (tables, rows, columns) on top of Appwrite Databases
- **Backend Functions:** `message-action` (Node.js 18) handles all cross-user writes for messaging and task reactions. Actions are enumerated in §20.3. Required scopes: `rows.read`, `rows.write`, `tables.read`. `tables.write` is intentionally absent because this function does not create or alter tables. Add `tables.write` only if Appwrite 2.0 docs or the Console API-key scope check requires it for cross-user `upsertRow`/`updateRow`; row-level writes should remain governed by `rows.write`.
- **PWA:** `vite-plugin-pwa` (with `registerType: 'autoUpdate'`)
- **Auth:** React Context (`AuthProvider`) is the single source of truth for the authenticated user. See §23. `useAuth` is a thin consumer shim; no hook mounts its own `account.get()`.

## 5. The "Brain Generates, Human Executes" Workflow
- **AI Role:** The AI writes 100% of the production-ready code. No local AI agents are used for coding
- **Human Role:** The user manually creates files, pastes the AI's code, and runs terminal commands
- **Code Generation Rules:** The AI must output complete, copy-pasteable files (no `// ... rest of code` placeholders). Files should be organized by logical separation, not arbitrary line limits

## 5.1 Revision Workflow (Mega File + Installer)

All future AI revisions are delivered as a **single fenced code block** tagged `mosaic`. The outer fence uses **exactly four tilde characters** as its boundary. It opens with those four tildes immediately followed by the word `mosaic`, and closes with those four tildes alone on their own line. That is the only place four consecutive tildes appear in the entire workflow. Every example shown in this document, and every Markdown or code fence inside file contents, uses **three or fewer** tilde or backtick characters, so nothing inside can ever be confused with the outer boundary.

Why four tildes: the installer's outer-fence regex is `/^(~~~+|`{3,})mosaic\s*\n([\s\S]*?)\n\1\s*$/`. The `\1` backreference requires the closing fence to match the opening fence's character AND length exactly. A four-tilde opening can only be closed by a line of exactly four tildes; any three-tilde or three-backtick fence inside the content is inert to the outer matcher. This is what allows §5.1 itself to show three-tilde examples without them being mistaken for the outer boundary.

Format (the inner example below uses three tildes; an actual delivery uses four):

~~~mosaic
===FILE:path/to/file.ext===
<complete file content>
===FILE:path/to/other.ext===
<complete file content>
===DELETE:path/to/removed.ext===
===COMMIT:audit: auth context and shared lifecycle===
~~~

**Fence rules:**

- **OUTER fence** — wraps the entire mega file.
  - Opens with exactly four tilde characters immediately followed by the word `mosaic` (no space between them).
  - Closes with exactly four tilde characters alone on their own line.
  - Always four tildes. Never three. Never backticks. Never mixed character or length.
- **INNER fences** — anything inside file contents: code examples, Markdown snippets, TypeScript blocks, prose examples.
  - Any fence character and any length **up to three characters** is fine: three backticks, three tildes, a mix, whatever the content needs.
  - The parser treats them as inert because their character and/or length differs from the outer fence.
  - Content inside an inner fence is treated as literal — the parser will not interpret `===FILE:` / `===DELETE:` / `===COMMIT:` lines that sit inside an inner fence as directives.
- The parser strips the outer fence first (regex above), then scans the remaining content line-by-line with CommonMark fence rules, tracking which lines sit inside an inner fence. Only lines that are *not* inside an inner fence can be directives.

**Common pitfalls:**

- **Do NOT use three tildes for the outer fence when the content contains three-tilde examples.** The first inner example closes the outer fence early; the rest of the file is treated as prose and no files are written.
- **Do NOT use backticks for the outer fence.** Backticks interact badly with nested backtick examples in AI chat renderers — the same premature-close problem, plus some renderers mangle escaped backticks.
- **Do NOT mix the outer fence's character or length.** If it opens with tildes it must close with tildes; if it opens with four characters it must close with four. The `\1` backreference will fail otherwise and the block will be rejected.
- **Do NOT show a four-tilde fence example anywhere inside this document, including §5.1.** Every example in `PROJECT_CONTEXT.md` uses three tildes. The only place four tildes appear is the opening and closing boundary of an actual mega file being delivered for install.

Additional rules (unchanged):

- One fenced block per logical change. No prose before or after (aside from a single confirmation line).
- Full file contents only — no diffs, no placeholders, no elisions.
- Directives (`===FILE:`, `===DELETE:`, `===COMMIT:`) must be at line start, exactly as shown.
- Do not escape content. Do not nest `mosaic` blocks.
- `===COMMIT:...===` is optional. If absent, the installer emits a generic fallback based on the touched paths.

The user pastes the block into `pending-changes.txt` (project root, gitignored), then runs one of:

| Command | Purpose |
|---|---|
| `npm run apply:dry` | Parse + validate, no writes |
| `npm run apply` | Write files, lint, test, build |
| `npm run apply:docs` | Write files, skip lint/test/build |
| `npm run apply:start` | Write, lint, test, build, start dev server |
| `npm run apply:rollback` | Restore from the most recent backup |

The installer (`apply-changes.mjs`) backs up every modified or deleted file to `.mosaic-backup/<timestamp>/` before writing. On lint, test, or build failure it exits without restoring; the user runs `npm run apply:rollback` explicitly to revert.

**Parser is fence-aware (CRITICAL).** `parseMegaFile` runs a two-pass scan:

1. Pass 1 marks every line that sits inside a Markdown fence (backticks or tildes; CommonMark rules: opening and closing runs must be the same character, closing run must be ≥ opening length; fence-boundary lines themselves are marked "inside").
2. Pass 2 performs the linear directive scan but **refuses to match any directive on a line marked "inside"**.

This means `===FILE:...===` examples appearing inside a fenced code block (like the ones in this section, and in the emission template below) are treated as literal content, not as directives. Without this guard the parser would truncate the enclosing file at the first example directive, create phantom files at the example paths, and override the outer `===COMMIT:...===` with any example commit line found inside the fences.

**Mega-file emission template (append to every audit/fix prompt):**

~~~mosaic
===FILE:path/to/file.ext===
<complete file content>
===FILE:path/to/other.ext===
<complete file content>
===DELETE:path/to/removed.ext===
===COMMIT:<type>: <short description>===
~~~

Rules:
- The outer fence is exactly four tildes. Do not use three tildes or backticks for the outer boundary. Inner fences of length ≤ 3 are inert.
- One fenced block. No prose before or after.
- Full file contents only — no diffs, no placeholders, no elisions.
- `===FILE:path===`, `===DELETE:path===`, and `===COMMIT:...===` must be at line start, exactly as shown.
- Do not escape content. Do not nest `mosaic` blocks.
- The COMMIT directive uses the user's convention: `audit: ...`, `ui: ...`, `feat: ...`, `fix: ...`, `chore: ...`, `hooks: ...`, `lib: ...`, `docs: ...`.
- Content inside Markdown fences (backticks or tildes) is treated as literal — the parser will not interpret `===FILE:` examples inside such fences as directives.

## 6. Appwrite 2.0 Strict Guardrails (CRITICAL)
- **Regional Endpoint:** Must use the specific regional endpoint found in the project URL (e.g., `https://sgp.cloud.appwrite.io/v1`), NOT the generic `cloud.appwrite.io`
- **Use TablesDB, NOT Databases:** All SDK calls must use the TablesDB service (e.g., `tablesDB.upsertRow`, `tablesDB.updateRow`), not the deprecated Databases service
- **Permission String Format:** Use the new format: `create("any")`, `read("any")`, `update("any")`, `delete("any")`. The old `"role:any"` formats are deprecated
- **Row-Level vs Table-Level Permissions (VERIFIED):** `Permission.create()` **does NOT apply to rows**. Applying it to a row throws an error. Row-level permissions must only ever be `[read, update, delete]`. The **`create` permission belongs on the TABLE-level permissions** in the Appwrite Console (e.g., grant `create("users")` at the table level so authenticated users can insert new rows). If new-row sync fails with 401/403, the fix is in the Console, NOT in `buildRowPermissions`
- **`updateRow` vs `upsertRow` (CRITICAL):** `upsertRow` is a **full replace (PUT semantics)** in Appwrite 2.0 — any column omitted from `data` is reset to its column default. `updateRow` is a **PATCH** — omitted columns are left untouched. The sync engine **must** use `updateRow` for rows that already exist remotely, and `upsertRow` **only** for brand-new rows. Failing to do this caused `read_at` on outgoing messages to be wiped on every sync cycle
- **Cross-User Writes Go Through Appwrite Functions:** A user can only assign permissions they themselves hold. To write a row owned by another user (recipient's message copy, sender's task reaction, sender's read receipt), the write must be performed inside an Appwrite Function using its API key. Direct client writes to another user's row will 401/403 (see §20.3 for the messaging implementation)
- **REST Endpoints:** Base path for tables is `/v1/tablesdb/{databaseId}/tables/{tableId}`
- **ID Mapping:** RxDB primary key `id` maps directly to Appwrite's `$id` column
- **Row ID Length Cap (CRITICAL):** Appwrite `rowId` values must be **≤36 characters**, matching `[a-zA-Z0-9_]+`, and MUST NOT start with a leading underscore. Any locally-generated ID that will become a remote `rowId` (settings, diary, or deterministic composite IDs) must respect this limit. **Rule:** when building `${userId}_${key}` IDs, validate the total length; if it exceeds 36 chars, fall back to a deterministic hashed ID (see §11)
- **Session Management:** Appwrite sometimes auto-creates a session on signup. Always wrap `account.createEmailPasswordSession` in a `try/catch` during signup, and explicitly clear stale sessions (`account.deleteSession('current')`) before login to prevent "Session is already active" errors
- **`$sequence` Type Change:** In Appwrite 2.0, `$sequence` is now a `string` (was `int`). Currently unused in this codebase, but note it if you ever sort by sequence
- **`Parameters<T>` on SDK Methods Picks the Wrong Overload:** Appwrite's TablesDB/Storage/Functions methods are overloaded; TypeScript's built-in `Parameters<typeof method>` utility resolves to the **last** overload, which for these methods is a deprecated `(id: string, ...)` form. Never use `Parameters<>` to derive param types for these methods. Define the param shape explicitly in `src/lib/sdk.ts` and cast at the call boundary (`params as never`). See §15 for the guarded SDK surface.

## 7. UI/UX & Architectural Guardrails
- **Dynamic Colors:** Category colors MUST be applied via inline styles (`style={{ backgroundColor: cat.color }}`). NEVER use dynamic strings in Tailwind classes
- **Predefined Colors Only:** Use a strict array of hex codes (`src/constants/colors.ts`) for the `ColorPalettePicker`. NO free-form hex inputs
- **Bottom Sheet Standardization:** All modals MUST use the `<BottomSheet>` primitive (see §13 for file layout and nested-sheet choreography). **CRITICAL:** `<BottomSheet>` MUST use `ReactDOM.createPortal` to render directly into `document.body` to escape parent z-index and overflow traps, guaranteeing it sits above the `BottomNav`. **Drag Restriction:** Drag-to-close must be restricted to the header handle using Framer Motion's `useDragControls` and `dragListener={false}` on the main container. This prevents accidental closes while scrolling content
- **Sticky Layout Rules:** For `position: sticky` to work correctly inside the app, `MainLayout` root must be `h-screen overflow-hidden`, and the `<main>` tag must be `flex-1 overflow-y-auto`
- **Non-Sticky Home Chrome:** On the Home page, the person carousel, profile header, `TopBar`, and calendar date header are **intentionally NOT sticky** — they scroll away with content so the calendar grid owns the whole viewport on long days. Do not re-add `sticky top-0` to these
- **Layout-Shift Reservation:** Any UI element whose visibility toggles on hover or interaction (message timestamps, status rows, hover-only controls) must **always reserve its space** in the layout. Toggle opacity, never presence. This prevents the hover-flicker feedback loop where content reflow pushes the cursor off the element, causing infinite toggle
- **Gesture Priority on Interactive Elements:** swipe > long-press > double-tap > single-tap. Single-tap must be deferred (~300ms) to distinguish from double-tap. Any tap that fires on the same pointer sequence as a swipe or long-press MUST be suppressed via a flag on the gesture hook (see §21 for chat implementation)
- **RxDB Reserved Keywords:** NEVER use `deleted` as a field name in RxDB schemas (see §12)
- **Soft Deletes:** Never hard delete. Always use `isDeleted: true` for RxDB tombstones
- **Strict ISO Dates:** All date fields MUST be stored as ISO 8601 strings (`yyyy-MM-dd` for day keys, full `.toISOString()` for timestamps)
- **iOS Storage:** Must call `navigator.storage.persist()` on app launch to prevent WebKit from purging IndexedDB
- **Coming Soon:** Bottom nav has 5 tabs: Home, Explore, Notifications, Messages, Account. Notifications renders a full `<ComingSoon />` page

## 8. Current Progress & State (As of Latest Build)
- ✅ **Phase 1.1 – 1.3 Complete:** App Layout, Primitives (Button, Input, Avatar, OfflineBanner), BottomSheet (with Portal & Drag Controls), Auth Flow (with session clearing), PWA Config, and React Router wiring
- ✅ **Phase 2.1 – 2.2 Complete:** Home Page Shell, View Memory (localStorage), Calendar View (Month/Week) with refined grid styling, natural text cutoff, perfect vertical alignment, and smart view-switching logic
- ✅ **Phase 2.3 Complete:** Day View Bottom Sheet with inline task creation, real `useTasks` data wiring, task action sheet, memo sheet, date picker, image picker/viewer, and delete confirmations
- ✅ **Phase 2.6 Complete:** Category Manager Sheet, Color Palette Picker (with Default/Vibrant/Pastel tabs), and `useCategories` hook wired to RxDB
- ✅ **Conventions Hardening Complete:** `window.confirm` eliminated (nested sheet pattern enforced), iOS focus behavior fixed (ref-based), Appwrite row-permission correctness verified, `updateRow` (PATCH) vs `upsertRow` (PUT) semantics enforced in sync engine
- ✅ **Person Carousel Complete:** Home page person carousel with Me + friends, per-person calendar switching (direction-aware slide animation via Swiper), `useCalendarState` refactor (shared state + `CalendarHeader` + `CalendarBody`), `FriendCarouselSettingsSheet` (Framer Motion `Reorder` + visibility toggles), `friendBio` schema v1 with lazy profile backfill, and settings rowId hashing to satisfy Appwrite's 36-char limit
- ✅ **Social Graph Complete:** Explore page with search, friend requests (incoming/outgoing), accept/decline/cancel, block, remove, `useFriends`, `useProfileLookup`, `useMyProfile`, `SetUsernameSheet`
- ✅ **Phase 3.0 – Friend Calendar Complete:** `FriendCalendarPage` (full route), `FriendCalendarView` (Embla month/week carousel), `FriendDayViewSheet` (read-only task detail with reply affordance), `useFriendCalendar`, `friendData` + `friendCache` (5-min IndexedDB TTL), `get_friend_calendar` action on `message-action`
- ✅ **Phase 3.1 – Messaging Core Complete:** RxDB `messages` collection (v3), two-row cross-user pattern, `message-action` Appwrite Function (`deliver`, `mark_read`, `unsend`, `react`), `useMessages` (per-thread), `useConversations` (inbox with every accepted friend), `useUnreadMessages`, `MessagesPage`, `ChatPage`, `MessageBubble`, `MessageComposer`, `MessageActionSheet`, `EmojiPickerSheet`, `ReactionRow`, `TaskRefCard`, `ReplyPreview`, `ReplyComposerSheet`, `ScrollToBottomButton`, `ChatSearchBar`, outbox delivery in `messageDelivery.ts`, deterministic thread + recipient row IDs in `threads.ts`, shared `reactionUtils.ts`
- ✅ **Phase 3.2 – Chat Polish Complete:** swipe-to-reply (contextual direction), double-tap ❤️, single-tap timestamp reveal, unified `useBubbleGestures` hook (replaces `useLongPress`), read receipts with per-message "Seen at" indicator, delivery indicators, scroll-to-bottom FAB with unread dot, chat search (`Cmd/Ctrl+F`/`K`, `Esc` to close), copy improvements for task refs
- ✅ **Phase 3.3 – Task Reactions Complete:** heart button in `FriendDayViewSheet`, `react_to_task` action, chip row on friend tasks (interactive) and own tasks (display-only), emoji-picker-driven chat message on `add`
- ✅ **Phase 3.4 – Auth Architecture Hardening Complete:** `AuthProvider` React Context is the single source of truth for session state. Single `account.get()` per app load instead of ~22. Logout now returns `boolean` and callers gate navigation on success. Mid-session 401 from sync, message delivery, friend-data, social reads/writes, image upload/fetch, and export now dispatch a global `auth:unauthorized` event that clears auth state and redirects to `/login`. Multi-tab logout and cross-tab login sync via `localStorage` broadcast. Mount-time network errors no longer redirect to `/login`; `AppLayout` renders a retry screen instead. See §23.
- ✅ **Backlog Closure 1–7 Complete:** §4 scope annotation, §8 chronological reorder, §9 parenthetical removal, §20.3/20.5 cross-refs, §18 local-dirty-wins documented. `message-action`: `mark_read` returns `{ markedPartner, markedCaller }`, `handleDeliver` rejects empty content (no content/taskRef/replyTo) and enforces `msg_` prefix, `resolveLegacyPeerRowId` cap log includes candidate count, `handleReact` uses two-phase read-then-write (overflow pre-check prevents partial commit). Wrapper polish: `makeUnauthorizedError()` helper in `authEvents.ts`; `friendData` 401 throws `FriendAccessError('forbidden')` with `code = 401`; `isUsernameAvailable` returns `null` for all non-auth failures (network, 5xx, parse) and 401, `false` only for "taken"; `SetUsernameSheet` distinguishes "could not check" from "taken". Delivery/sync polish: `deliverPendingMessages` capped at 5 iterations with `[messageDelivery] delivery loop hit cap` warning; `sync.ts` adds non-429 failure backoff (5s→60s exponential) separate from rate-limit backoff. UX polish: `toggleReaction` returns `'ok' | 'timeout'`; `ChatPage` shows "Couldn't send reaction. Try again." toast on timeout-revert. Enforcement: new `src/lib/sdk.ts` guarded SDK surface; ESLint `no-restricted-imports` blocks raw `TablesDB`/`Storage`/`Functions`/`Account` imports outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`.
- ✅ **Calendar Perf Audit Complete:** Slide windowing in `useCalendarState`/`CalendarBody`/`FriendCalendarView` (RENDER_WINDOW = 2), memoized `tasksByDate` Map, memoized `DayCell` with stable props, memoized `CalendarBody`, ref-counted object-URL cache in `useTaskImage`, friend-pane activation refetch throttle. Dead code removed: `CalendarView.tsx`, `ViewContainer.tsx`, `DiaryView.tsx`, `TodoListView.tsx`. See §16 "Calendar Rendering Pipeline" for the invariants.
- ✅ **Test Suite Layers 1–5 Complete:** 211 tests across 26 files in four Vitest projects (`unit`, `handlers`, `react`, `components`). Layers 1 + 3 test pure functions (`reactionUtils`, `syncMapping`, `threads`, `visibility`, `settingsRowId`, `appwriteParity`); Layer 2 tests every `message-action` handler with a mocked `node-appwrite` via `invoke-handler.ts`; Layer 4 tests hook contracts (`useConversations`, `useMessages`, `useTaskImage`, `useUnreadMessages`) against a real in-memory RxDB built by `testDb.ts`; Layer 5 tests component behavior in happy-dom with `@testing-library/react` (`BottomSheet`, `CategorySection`, `ChatSearchBar`, `ConversationRow`, `MessageBubble`, `MessageComposer`, `ReactionRow`, `TaskActionSheet`, `TaskVisibilitySheet`, `UserResultCard`). The installer's verify block now runs `npm test` between lint and build (§5.1), so any test failure gates a patch before it lands. See §24 for layout, philosophy, and the test helper's deliberate divergence from `src/db/database.ts`.
- 🔄 **Next Up:** Phase 3.5 — Todo List View; Phase 3.6 — Diary View; Phase 3.7 — Notifications tab (in-app notifications for message/reaction events)

---

## 9. Hook & State Conventions
- **Hook Return Shape:** Every custom hook MUST return a **named object**, never an array. Standard shape: `{ <domain>, isLoading, ...mutators }` where `<domain>` is the plural (or singular for singletons like `profile`) domain noun — e.g., `{ tasks, isLoading, addTask, ... }`. Mutators are always `useCallback`-wrapped
- **User-Scoped Data Guard:** Any hook that reads user data (`useTasks`, `useCategories`, `useDiary`, `useSettings`, `useMessages`, `useConversations`) MUST track a separate `loadedUserId` (or `loadedKey`) state alongside the data. Expose data only when `loadedUserId === userId`; otherwise return `[]` and set `isLoading = true`. This prevents cross-user data leakage during logout/login transitions
- **Dependency Arrays:** Hooks MUST depend on `user?.$id` (primitive string), NEVER the `user` object itself. Prevents re-subscription storms from Appwrite object identity churn
- **Observable Subscriptions:** All RxDB reads use `query.$.subscribe(...)` inside a `useEffect`, storing the subscription and unsubscribing in cleanup. Always pair with an `isMounted` boolean guard before calling `setState`
- **Mutator Signatures:**
  - Add: `Omit<Doc, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>`
  - Update: `(id: string, updates: Partial<Doc>)`
  - Both always `useCallback` with `user?.$id` in deps
- **"Sync State From Props" Pattern:** When a component receives a doc via props but needs local editable state, use the *render-body reset* pattern:
  ```tsx
  const [syncedId, setSyncedId] = useState<string | null>(null);
  if (task?.id !== syncedId) {
    setSyncedId(task?.id ?? null);
    setEditedValue(null);
  }
  const value = editedValue ?? task?.field ?? '';
  ```
  This is the canonical replacement for useEffect-based prop-syncing in sheets/modals (MemoSheet, DatePickerSheet, EditTaskSheet, DayViewSheet)
- **Primitive-Only Deps in Effects:** When an effect needs to react to a document prop, read `const taskId = task?.id ?? null` at the top of the component and use `taskId` in both the effect body and the deps array. NEVER reference the whole `task` object inside the effect. This satisfies `react-hooks/exhaustive-deps` AND prevents re-fire on RxDB identity churn
- **Debounced Persistence in Sheets:** When a sheet needs to persist live reorder state (e.g., `FriendCarouselSettingsSheet`), debounce the write (~400ms) inside a `useEffect` keyed on the local items array. Do NOT write on every drag tick
- **In-Flight Ref Guard for Idempotent Multi-Row Patches:** Any hook operation that patches multiple rows in a loop (`markAllRead`, batch unsends) MUST have a `useRef<boolean>` in-flight guard. Inside the loop, re-fetch each doc right before patching (`findOne(id).exec()`) to obtain the latest revision. RxDB throws `CONFLICT` when patching a stale revision
- **Optimistic + Revert for Cross-User Writes:** When patching a foreign row (`reactToTask`, `toggleReaction`), apply the optimistic local update first, call the server, and revert the local change on failure. Never block the UI on the server round-trip. If the server returns a resolved row ID (e.g., legacy message backfill), persist it locally so the next call doesn't need a lookup. When the revert is triggered by a delivery timeout (pending message never delivered within the 5s window), the mutator SHOULD signal the revert to the caller via a return value (see `toggleReaction` → `'ok' | 'timeout'`) so the UI can show a targeted toast (§21)
- **Auth Is Not a Data Hook:** `useAuth` is a thin consumer of `AuthContext` (see §23). It does NOT mount its own `account.get()`, does NOT track a `loadedUserId`, and does NOT own session state. All session state, session transitions, and auth-error handling live in `AuthProvider`. Never add per-consumer auth state to a hook or component
- **Async-First Effects That Set State:** Any effect that ends up calling a state-setting function (including via an async callback) MUST structure that function so all `setState` calls occur after the first `await`, or defer via `queueMicrotask`. Synchronous setState from an effect body triggers the `react-hooks/set-state-in-effect` rule and causes cascading renders
- **Context Split for Fast Refresh:** A file that exports a React component MUST NOT also export a non-component value (context object, hooks, constants). Split them: `authContext.ts` holds `AuthContext` + `AuthContextValue`; `AuthProvider.tsx` holds only the component. This satisfies `react-refresh/only-export-components`

## 10. Error Handling & Logging Conventions
- **Hook/Service Log Prefix:** All `console.error` and `console.warn` calls MUST be prefixed with `[ComponentName]` or `[hookName]` in square brackets. Active prefixes include: `[useTasks]`, `[useMessages]`, `[useConversations]`, `[messageDelivery]`, `[ChatPage]`, `[useFriendCalendar]`, `[PersonPane]`, `[FriendCalendarPage]`, `[Storage]`, `[Sync]`, `[Bootstrap]`, `[RxDB]`, `[CategoryManagerSheet]`, `[ReplyComposerSheet]`, `[EmojiPicker]`. Makes log filtering trivial
- **Guard Clause Errors:** When a mutator is called without an authenticated user, log `[hookName] Cannot <action>: User not authenticated` and return silently. Never throw — the UI shouldn't crash because of a race with logout
- **Silent Session Cleanup:** Before any `account.createEmailPasswordSession`, wrap a `try { await account.deleteSession('current') } catch {}` — swallowing that error is intentional and required. ESLint's `no-empty` rule is configured with `allowEmptyCatch: true` (see §15) specifically to permit this pattern without requiring a placeholder comment inside the block
- **DEBUG Gating:** Non-error diagnostic logs MUST be wrapped in `if (import.meta.env.DEV)` or gated behind a module-level `const DEBUG = import.meta.env.DEV`. Never log to production consoles
- **Error Surfacing to UI:** Use a fixed-position toast (`fixed bottom-24 left-1/2 -translate-x-1/2 z-[70]`) with auto-dismiss via `setTimeout` (2000ms) — see DayViewSheet's `deleteFeedback` and `ChatPage`'s `feedback` patterns. Do not use `alert()` for anything except placeholder "Coming Soon" features
- **Invalid RowId Recovery:** If sync logs an `Invalid rowId` error for a locally-created doc, that doc will retry forever. The owning hook (e.g., `useSettings`) must scan for and `remove()` any legacy rows whose ID violates Appwrite's constraints during its init phase (see §11)
- **`CONFLICT` Is Not an Error:** `markAllRead` and `toggleReaction` patch rows that a parallel sync cycle may have updated. Catch `err.code === 'CONFLICT'`, re-fetch the doc, and either retry once or skip. Do NOT log `CONFLICT` as an error — it's an expected race
- **Fire-and-Forget Cross-User Writes:** `markReadOnRemote`, `unsendOnRemote`, `reactOnRemote`, `reactToTaskOnRemote` intentionally swallow errors after logging. The user's local state is the source of truth; the server call is best-effort. Only `deliver` retries via the pending outbox
- **401 Detection & Global Redirect:** Any SDK call or `fetch` that can return 401 MUST route through `guardedCall` from `src/lib/authEvents.ts` (see §15 for the guarded SDK surface that wraps this). `guardedCall` uses `isUnauthorizedError(err)`; on match it calls `dispatchUnauthorized()` to fire the global `auth:unauthorized` window event. `AuthProvider` listens and clears user state, which causes `AppLayout` to redirect to `/login`. Do NOT redirect from the call site. For synthetic 401s constructed from raw `fetch` responses or from Appwrite Function execution result codes, use the `makeUnauthorizedError()` helper rather than inlining `const err = new Error('Unauthorized'); (err as { code?: number }).code = 401;`
- **Differentiate "Not Logged In" From "Couldn't Check":** A 401 from `account.get()` means "definitely not logged in." A network error, timeout, or offline state means "couldn't check." These MUST be handled differently. The former clears user state; the latter sets `isOffline = true` and lets `AppLayout` render a retry screen instead of redirecting
- **Logout Returns Success:** `useAuth().logout()` returns `Promise<boolean>`. Callers MUST check the return value before navigating away. Never assume logout succeeded. This applies to `SettingsPage.handleLogout`, `AccountPage.handleLogout`, and any future caller. See §23 for the full pattern
- **Multi-Tab Auth Broadcast:** Login and logout both write a JSON payload (`{ type: 'login' | 'logout', at: number }`) to `localStorage` under the key `mosaic_auth_broadcast`. Other tabs listen via the `storage` event and either clear user state (logout) or re-run `account.get()` (login). Never broadcast user credentials or tokens — only the event type

## 11. ID Generation & Naming
- **Client-Generated IDs:** All primary keys are generated client-side (no server round-trip) with a type prefix:
  - Tasks: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Categories: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Messages (sender's local row): `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Images: `img_${crypto.randomUUID().replace(/-/g, '')}` (with a `getRandomValues` fallback for iOS)
  - Deterministic composite IDs (settings, diary): `${userId}_${key}` or `${userId}_${date}` — **but only when the total length is ≤36 chars** (see §6 Row ID Length Cap)
- **`msg_` Prefix Is Server-Enforced:** `message-action.handleDeliver` rejects any `messageId` that does not start with `msg_` (`Invalid messageId format`, HTTP 400). The client already generates this prefix in `useMessages`; the server guard exists to defend against direct SDK calls and future code paths that bypass `MessageComposer` (see §20.3)
- **Thread IDs (Messaging):** `th_${sha256Hex(sortedUserIdA + '|' + sortedUserIdB).slice(0, 30)}`. Deterministic — both participants compute the same value. Total length: 33 chars. Helper: `makeThreadId(userA, userB)` in `src/lib/threads.ts`
- **Recipient Row IDs (Messaging):** `rmsg_${sha256Hex(senderMessageId).slice(0, 30)}`. Deterministic — the sender's client can compute the recipient's row id without a server round-trip. Helper: `makeRecipientRowId(senderMessageId)` in `src/lib/threads.ts`
- **Settings Row ID Hashing:** Because `${userId}_${key}` easily exceeds Appwrite's 36-char cap for long keys (`friend_carousel_prefs`, etc.), `useSettings` uses a `makeSettingsRowId(userId, key)` helper:
  1. If `${userId}_${key}` fits in ≤36 chars → use it as-is (keeps short keys like `displayName` stable)
  2. Otherwise → return `s_${hashString(userId + '_' + key)}` where `hashString` is a deterministic dual-djb2 variant producing a ~12–14 char base36 string
  Any new feature that needs a long settings key automatically gets a valid Appwrite row ID without schema changes
- **Friendship Row IDs:** Deterministic SHA-256 based: `fr_${hex.slice(0, 32)}` from `${ownerId}|${friendId}` (already 35 chars, safe)
- **Random Suffix Convention:** For the random suffix, use `.substr(2, 9)`. Reserve `.slice(n, m)` for truncating deterministic hashes (thread IDs, friendship IDs, recipient row IDs)

## 12. Field Naming & Serialization
- **Local ↔ Remote Mapping Rules:**
  - RxDB is camelCase; Appwrite TablesDB columns are snake_case
  - All mapping is centralized in `src/db/sync.ts` (`toAppwriteFormat` / `fromAppwriteFormat`). Never map ad-hoc in hooks or components
  - `isDeleted` (local) ↔ `deleted` (remote) — this is a hard rule because `deleted` is a reserved RxDB keyword
  - Booleans encoded as booleans, not 0/1
- **`messages` Collection Field Mapping:**
  | Local | Remote |
  |---|---|
  | `threadId` | `thread_id` |
  | `senderId` | `sender_id` |
  | `recipientId` | `recipient_id` |
  | `direction` | `direction` |
  | `taskRefId` | `task_ref_id` |
  | `taskRefTitle` | `task_ref_title` |
  | `taskRefDate` | `task_ref_date` |
  | `taskRefColor` | `task_ref_color` |
  | `replyToId` | `reply_to_id` |
  | `replyToContent` | `reply_to_content` |
  | `replyToSenderId` | `reply_to_sender_id` |
  | `isUnsent` | `is_unsent` |
  | `originalMessageId` | `original_message_id` |
  | `reactions` | `reactions` |
  | `readAt` | `read_at` |
  | `deliveryStatus` | `delivery_status` |
- **`read_at` Is Server-Owned on Outgoing Rows:** `toAppwriteFormat` for `messages` MUST omit `read_at` when `direction === 'outgoing'`. The client would otherwise overwrite the read receipt that the `mark_read` action wrote. This applies only to the `messages` collection
- **Date Storage:**
  - Day keys (task date, diary date, sorting): `yyyy-MM-dd` via `date-fns.format`
  - Timestamps (`createdAt`, `updatedAt`, `completedAt`, `readAt`): full ISO 8601 via `.toISOString()`
  - When comparing timestamps, always use the `toMs()` helper pattern (`Number.isFinite` guard)
- **Empty-String Over Null:** Optional string fields (`memo`, `image`, `completedAt`, `icon`, `friendBio`, `threadId`, `replyToId`, `replyToContent`, `replyToSenderId`, `originalMessageId`, `reactions`, `readAt`) MUST default to `''`, never `null` or `undefined`, so RxDB schema validation never fails
- **Reactions Format:** JSON string of `Array<{ emoji: string; userIds: string[] }>`. Serialized as `''` when empty (not `'[]'`). Parsed/stringified only via `src/lib/reactionUtils.ts`
- **Schema Migrations:** When adding a new optional field to an existing RxDB collection, bump the schema `version` and add a `migrationStrategies` entry in `database.ts` that backfills the field with `''` (or `false` for booleans). Also update both `toAppwriteFormat` and `fromAppwriteFormat` in `sync.ts`, and run a one-off `scripts/*.mjs` script to add the corresponding Appwrite column (e.g., `scripts/add-message-reactions-columns.mjs`). The test helper `tests/helpers/testDb.ts` mirrors `database.ts`'s strategies and MUST be updated in lock-step — see §24.5

## 13. Modal & Bottom Sheet Structure
- **One Sheet = One File:** Every sheet lives in its own file and takes `{ isOpen, onClose, <entity>, onSave/onConfirm }` props. No context-based sheet orchestration. (Primitive rules: see §7)
- **Nested Sheet Choreography:** When one sheet opens another (TaskActionSheet → MemoSheet), the parent passes `isLocked={isBackgroundLocked}` down. `isBackgroundLocked` is computed from a single boolean OR of all child-sheet open states
- **Action Sheets Close Themselves Before Opening a Sibling:** When an action button in TaskActionSheet needs to open MemoSheet, ImageViewer, etc., the pattern is: `onClick={() => { onX(); onClose(); }}` — the action sheet must visually dismiss before the sibling opens
- **Sheet Content Padding:** Sheet bodies use `pt-2 pb-8 px-4` (or `px-1` for full-width lists). Do not add extra wrappers
- **Delete Confirmations:** Destructive flows inside a sheet MUST open a nested BottomSheet with `isLocked={true}` and a two-button `[Cancel | Delete]` row (`bg-[#2A2A2A]` / `bg-red-500`). `window.confirm` is BANNED in sheets. Reference implementations: DayViewSheet's "Delete Photo", CategoryManagerSheet's "Delete Category", ChatPage's "Unsend Message"
- **Deleting State:** Nested delete-confirm sheets track a local `isDeleting` boolean and render a spinner inside the Delete button while the async operation is in flight
- **Reorderable Sheets:** Lists that support drag-to-reorder use Framer Motion's `Reorder.Group` / `Reorder.Item` with `dragListener={false}` on the item and a dedicated grip handle that calls `dragControls.start(e)`. Never enable whole-row drag in a scrollable sheet

## 14. Component Conventions
- **Export Style:** Components are named exports (`export const Foo: React.FC<Props> = ...`). No default exports except `App.tsx`
- **Props Interface Above Component:** Always declare `interface XxxProps { ... }` immediately above the component; never inline
- **Memo + displayName:** Any component wrapped in `React.memo` MUST set `.displayName` to the component name
- **Prop Callbacks:** Internal handlers are `handleX` (useCallback for anything passed to children or used in useEffect deps). External props are `onX`
- **Stop Event Leakage in Lists:** Buttons/inputs inside tappable rows MUST call `onPointerDown={(e) => e.stopPropagation()}` to prevent parent row's tap handler from firing (critical inside Swiper slides and message bubbles)
- **Animation Tokens:** Entry animations use `animate-in fade-in duration-300` or `animate-in fade-in slide-in-from-<dir>-1 duration-200`. Framer Motion `whileTap={{ scale: 0.95–0.98 }}` on all tappables
- **Spinner Primitive:** Loading spinners are ALWAYS `<div className="w-N h-N border-2 border-white border-t-transparent rounded-full animate-spin" />`. No SVG spinners, no library spinners
- **Unified Gesture Hooks:** Any element supporting more than one gesture (swipe + tap + long-press) MUST use a single state-machine hook (`useBubbleGestures`). Do not stack `useLongPress` + custom drag + tap handlers. Refs hold the internal gesture state; only visual output (`swipeOffset`, `isSwiping`) uses React state, throttled with `requestAnimationFrame`

## 15. File Organization Rules
- `src/components/ui/` — pure, entity-agnostic primitives (Button, Input, BottomSheet, Avatar, ColorPalettePicker, OfflineBanner, SettingsRow)
- `src/components/layout/` — chrome that wraps routes (MainLayout, BottomNav, AppLayout, ComingSoon)
- `src/components/home/` — Home page feature components (PersonCarousel, PersonProfileHeader, FriendCarouselSettingsSheet, TopBar, ViewSwitcher, HamburgerMenu, PersonPane)
- `src/components/home/views/` — calendar sub-views and their sub-sheets (CalendarHeader, CalendarBody, MonthView, WeekView, DayViewSheet, TaskItem, CategorySection, TaskActionSheet, etc.) plus the shared `useCalendarState` hook
- `src/components/friend/` — read-only friend views used by both HomePage's carousel content and `FriendCalendarPage` (FriendCalendarView, FriendDayViewSheet)
- `src/components/messages/` — chat feature (MessageBubble, MessageComposer, MessageActionSheet, ReplyComposerSheet, ReplyPreview, ReactionRow, EmojiPickerSheet, TaskRefCard, ConversationRow, ScrollToBottomButton, ChatSearchBar)
- `src/components/explore/` — social graph UI (ExploreView, SearchBar, UserResultCard, FriendRow, FriendRequestRow, OutgoingRequestRow, FriendActionSheet)
- `src/components/modals/` — account/settings modals (CategoryManagerSheet, AccountSettingsSheet, ChangeEmailSheet, ChangePasswordSheet, EditDescriptionSheet, EditNameSheet, EditProfileImageSheet, ExportDataSheet, SetUsernameSheet)
- `src/hooks/` — one hook per data domain (useTasks, useCategories, useDiary, useSettings, useFriends, useMessages, useConversations, useUnreadMessages, useFriendCarousel) plus focused utilities (useTaskImage, useImageCompression, useBubbleGestures)
  - Auth trio: `authContext.ts` (context object + types only, no component), `AuthProvider.tsx` (the provider component, no other exports), `useAuth.ts` (consumer hook). This split exists to satisfy `react-refresh/only-export-components` — do not merge
- `src/lib/` — side-effectful SDK wrappers and pure utilities (appwrite, storage, imageCache, social, friendCache, friendData, useFriendCalendar, messageDelivery, threads, reactionUtils, visibility, exportData, mockData). No React imports allowed here (except `useFriendCalendar.ts` which is a hook living under lib/ for historical reasons — do not move)
  - `authEvents.ts` — pure module: `AUTH_UNAUTHORIZED_EVENT` constant, `isUnauthorizedError(err)` predicate, `makeUnauthorizedError(message?)` helper (creates a synthetic 401-coded `Error`), `dispatchUnauthorized()` helper, `guardedCall<T>(fn)` wrapper. No React. Imported by every SDK wrapper that can receive a 401.
  - `sdk.ts` — **the guarded SDK surface.** Exports `guardedTablesDB`, `guardedStorage`, `guardedFunctions`, `guardedAccount`. Every method internally calls `guardedCall()`. Param shapes are defined explicitly (see §6 re: `Parameters<T>` on overloaded SDK methods). Raw SDK service classes (`TablesDB`, `Storage`, `Functions`, `Account`) may only be imported and constructed here and in `src/lib/appwrite.ts`. Enforced by ESLint `no-restricted-imports` (below). `guardedFunctions.createExecution` additionally normalizes `responseStatusCode === 401` (the SDK returns 401 executions instead of throwing) into a `makeUnauthorizedError()` before guardedCall's dispatch can miss it.
  - `appwrite.ts` — the only other file permitted to construct raw `Client`/`Account`. Exports `client` and `account` used by `sdk.ts`.
- `tests/` — Vitest test suite (four projects: `unit`, `handlers`, `react`, `components`). See §24 for full layout, philosophy, helper contracts, and how to add new tests.
- Project root: `apply-changes.mjs` (mega-file installer, see §5.1), `pending-changes.txt` (gitignored input, see §5.1)

**ESLint enforcement of the SDK surface (`eslint.config.js`):**

- `globalIgnores` includes `['dist', '.mosaic-backup']`. The `.mosaic-backup` entry is required — the installer writes full-file snapshots there before each apply, and those snapshots can contain pre-fix code that would fail lint if scanned.
- For `**/*.{ts,tsx}`, a `no-restricted-imports` rule forbids importing `TablesDB`, `Storage`, `Functions`, or `Account` from `'appwrite'`. Message directs the developer to `src/lib/sdk.ts`.
- For `**/*.{ts,tsx}`, `no-empty` is configured as `['error', { allowEmptyCatch: true }]`. This permits the intentional `catch {}` cleanups documented in §10 (Silent Session Cleanup) without requiring a placeholder comment inside the block, which Repomix's comment-stripping otherwise removes and which causes spurious lint failures.
- A per-file override turns `no-restricted-imports` off for `src/lib/sdk.ts` and `src/lib/appwrite.ts` — the two legitimate construction sites. The `no-empty` relaxation is inherited at the base scope, not overridden per-file.

## 16. List Rendering & Sorting
- **Default Sort Contracts (in hooks, not components):**
  - Tasks: `[{ date: 'asc' }, { createdAt: 'desc' }]`
  - Categories: `[{ order: 'asc' }]`
  - Diary: `[{ date: 'desc' }]`
  - Messages (in-thread): `[{ createdAt: 'asc' }]`
  - Messages (conversation list): computed client-side from `createdAt` descending per thread
  - Friends (carousel): user-defined `order` first, then alphabetical by `friendDisplayName || friendUsername` for the un-ordered tail
- **Grouping is Memoized:** Any grouping (tasks-by-category, tasks-by-date, messages-by-thread) MUST use a `useMemo` that returns a Map or Record, not a `filter()` inside a `.map()`
- **Empty Arrays Are Module Constants:** Pass shared empty arrays as `const EMPTY_TASKS: TaskDocument[] = []` to keep `React.memo` prop equality stable across renders
- **Calendar Rendering Pipeline (perf invariants — do not regress):**
  - **Slides are windowed.** `useCalendarState` exposes `renderStart` / `renderEnd` derived from Embla's live `scrollProgress` and the `focusDate` index (union of the two, expanded by `RENDER_WINDOW = 2`). `CalendarBody` and `FriendCalendarView` render slide content only when `i` is inside that window; all 61 (or 25) slide containers are still emitted so Embla's scroll geometry is unchanged. Do not un-window the map.
  - **Tasks are indexed once.** `CalendarBody` and `FriendCalendarView` compute `tasksByDate: Map<string, TaskDocument[]>` via `useMemo` keyed on `tasks`, and pass the Map (not the array) into `MonthView` / `WeekView`. `DayCell` receives a per-day slice from the Map. Never reintroduce a per-day `.filter()` in `MonthView` / `WeekView`.
  - **`MonthView` / `WeekView` memoize their day arrays.** `calendarDays` (`MonthView`) and `weekDays` (`WeekView`) are `useMemo`-ized on `focusDate`. This is required so the `date` prop passed to each `DayCell` is referentially stable across renders — without it, `React.memo` on `DayCell` would never bail.
  - **`DayCell` is memoized and prop-stable.** It receives `date` (stable via the parent memo), `tasks` (stable via the Map, with `EMPTY_TASKS` for empty days), `categories` (parent `useMemo`), `isCurrentMonth` (primitive), and `onDayClick` (parent `useCallback`). `DayCell` builds its own click closure internally so the closure is not a memo-breaking prop. Sorting inside `DayCell` runs only when `tasks.length > 1` and is memoized on `tasks`.
  - **`CalendarBody` is memoized.** `PersonPane` re-renders on feedback-toast state, `activeView` changes, and reaction toasts; `CalendarBody` bails out via `React.memo` unless one of its stable props actually changed.
  - **Friend-calendar refetch on activation.** `PersonPane` forces `refetchFriendCalendar(true)` when a friend pane becomes active, throttled by `FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`. Without this, the pane's data is frozen at first mount (panes never remount when swiped away and back) and the 5-minute `friendCache` TTL keeps it stale well past when the friend added a new task. Own pane is exempt — it stays live via the RxDB subscription in `useTasks`.
  - **`useTaskImage` shares object URLs.** Module-level `Map<fileId, { url, refCount, revokeTimer }>` in `src/hooks/useTaskImage.ts` ref-counts object URLs across hook instances, with a 1.5s deferred revoke window so StrictMode double-mounts, `Month↔Week` toggles, and slide re-entry do not tear down and re-read the blob. Do not bypass this hook with a direct `getLocalImageUrl` call in calendar cells.
  - **`DayViewSheet` and `HomePage` (Swiper) use manual windowing.** `DayViewSheet` uses `RENDER_WINDOW = 3`, `HomePage` uses `RENDER_WINDOW = 1`. Do not remove those caps; they are load-bearing for scroll smoothness.

## 17. Native Input Quirks
- **Dark Theme `<input type="date">`:** MUST include `[color-scheme:dark]` Tailwind arbitrary class, otherwise the native picker renders light-theme
- **Focus Management:** When opening a sheet or inline "Add" input, focus via a `useRef` + `useEffect` on `[isOpen, taskId]`. NEVER use `autoFocus` — Safari/iOS ignores it inside conditionally-rendered subtrees (any AnimatePresence-wrapped BottomSheet). This applies to both memo editors and title editors, not just inline add inputs
- **File Input Reset:** After an `<input type="file">` upload completes (success OR failure), reset `fileInputRef.current.value = ''` so the same file can be re-selected
- **Body Scroll Lock:** BottomSheet is the only component allowed to touch `document.body.style.overflow`. It uses a module-level `openSheetCount` counter to handle nested sheets correctly
- **`touch-action: pan-y` on Gesture-Enabled Elements:** Any element that owns horizontal gesture handlers (message bubbles with swipe-to-reply) MUST set `touchAction: 'pan-y'` inline. Without it, iOS Safari interprets the horizontal swipe as browser back-navigation and suppresses the vertical scroll on that element

## 18. Async & Race Safety
- **Cancellation Ref:** Every async `useEffect` MUST have a local `let isMounted = true` (or `effectIsActive`) flag, and every `.then`/`await` continuation MUST check it before `setState`. Cleanup sets the flag to `false`
- **Programmatic-Move Guards:** When a component programmatically drives a carousel (Swiper, Embla), set an `isProgrammaticMoveRef.current = true` before calling `.slideTo()` / `.scrollTo()`, and clear it in a `requestAnimationFrame`. Event handlers (`onSlideChangeTransitionEnd`, `onSelect`) check this ref to ignore self-induced events — prevents infinite feedback loops between state and carousel
- **Re-entrancy Guards:** Sync/network loops use a module-level boolean (`isSyncInProgress`, `isDeliveryInProgress`) and log-and-return on re-entry rather than queueing
- **Bounded Loops:** Any loop that can be re-entered by external events (e.g., `deliverPendingMessages` when new messages arrive mid-cycle) MUST have an iteration cap. `deliverPendingMessages` caps at 5 iterations and logs `[messageDelivery] delivery loop hit cap (5); breaking` when exceeded. Remaining pending rows stay pending until the next trigger (`focus`, `online`, next send)
- **Attempt-Once Ref:** Lazy side effects that should only ever run once per entity (e.g., friend bio backfill) use a `useRef<Set<string>>` to track attempted entity IDs. Never rely on `useEffect` deps alone for "run only once" semantics
- **Fire-and-Forget Cross-User Writes:** Non-critical server actions (`mark_read`, `unsend`, `react`, `react_to_task`) are dispatched without awaiting for the UI. Errors are logged but never thrown to the caller. Delivery (`deliver`) is the exception — it retries via `deliverPendingMessages`
- **Polling in Long-Lived Screens:** `ChatPage` runs a 30s `forceSync()` interval while the tab is visible, to propagate read receipts. Guards: skip when `document.visibilityState !== 'visible'`, skip when `navigator.onLine === false`. Interval cleared on unmount
- **Auto-Scroll Pinning:** Chat message lists track an `isPinnedToBottomRef` updated synchronously in the scroll handler. Incoming messages auto-scroll only when pinned; outgoing messages always scroll. The scroll-to-bottom FAB reflects the un-pinned state
- **`queueMicrotask` for Effect-Triggered Async:** When an effect must kick off an async function that will setState, wrap the call in `queueMicrotask(() => { ... })` and re-check `isMountedRef.current` inside. This avoids `react-hooks/set-state-in-effect` while preserving correct ordering (the async function itself must be async-first — all setState after the first `await`)
- **Local-Dirty-Wins Conflict Semantics (Sync Engine):** When a locally-modified row (`_meta.lwt` newer than the last sync) conflicts with a remote tombstone (`deleted: true` on the server), the client keeps its local version and re-pushes it on the next sync cycle. This is deliberate: local edits are treated as user intent that outranks a stale server deletion. It is a known trade-off — if a user deletes a row on device A while device B has an unsynced edit, device B's edit will resurrect the row. Remote-wins was rejected because it caused silent data loss for offline edits. There is no per-collection override; the policy is global
- **Two-Phase Read-Then-Write for Multi-Row Server Mutations:** When an Appwrite Function writes to more than one row in a single action (`handleReact` writes both the caller's and the peer's row), it MUST be structured as two passes: **Pass A** reads and computes the next value for every target, validating each (e.g., `REACTIONS_MAX_LEN` overflow check); **Pass B** writes. If any Pass A validation fails, return 400/403 **before any write** — this prevents one-row-succeeded / one-row-overflowed partial commits. Residual risk: if a Pass B write fails after the first succeeded, the pair is partially committed and relies on the next sync cycle to reconcile. Documented as a known limitation in §20.7
- **Mounted Pane Freshness:** Any component that displays cached data from a source that can change externally AND stays mounted across navigation MUST refetch on activation, throttled by a module-level or hook-level minimum interval. Reference implementation: `PersonPane`'s friend-pane activation refetch (`FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`). Own-user panes are exempt if they subscribe live via RxDB. Do not rely on cache TTL alone — TTL only bounds maximum staleness, not the moment a user sees stale data.

## 19. Bootstrap & Persistence
- **Order of Operations in `main.tsx`:** 1) `navigator.storage.persist()`, 2) `initializeDatabase()`, 3) fire-and-forget `initializeSync()` for the cold-load-with-session case (never block render on network), 4) `ReactDOM.createRoot(...).render(<React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>)`
- **Non-Blocking Sync:** `initializeSync()` is always called with `.catch()` — a sync failure must never prevent the app from mounting
- **Auth Resolution Happens in `AuthProvider`, Not `main.tsx`:** The provider runs a single `account.get()` on mount (deferred via `queueMicrotask`) and broadcasts the result to every consumer via context. `main.tsx` does not call `account.get()` itself; it only sets up the provider
- **Login-Triggered Sync:** Because `initializeSync()` on cold load may run before any session exists (e.g., cold load on `/login`), `AuthPage.handleSubmit` calls `initializeSync()` after a successful `login`/`signup` and before navigating to `/home`. This closes the race where sync never re-runs after login
- **`ignoreDuplicate: true`** on `createRxDatabase` and a singleton `dbInstance` module variable are required to survive React StrictMode double-invocations
- **Local Cleanup on Init:** Data hooks should opportunistically purge known-bad local state (oversized row IDs, legacy composite IDs) during their init phase, before subscribing. This avoids permanent sync failures for users who already have broken rows in IndexedDB
- **Single `account.get()` Per Load:** In production, a cold authenticated load should fire exactly one `account.get()` (from `AuthProvider`). In dev with `<React.StrictMode>`, it will fire twice — this is expected. If you ever see more, an auth source has leaked back into a consumer. Verify with `console.count('account.get')` in `AuthProvider.resolveInitialUser`

---

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
| `deliver` | sender | Create the recipient's row via API key with recipient-owned permissions. Rejects `messageId` that does not start with `msg_`, and rejects messages that have no content, no task ref, and no reply target (`Message has no content`) |
| `mark_read` | recipient | Patch `read_at` on sender's outgoing rows (`WHERE user_id = sender AND thread_id = X AND direction = 'outgoing' AND read_at = ''`). Response body: `{ ok: true, markedPartner, markedCaller }` |
| `unsend` | sender | Patch BOTH rows: wipe content/refs/reactions, set `is_unsent=true`. Cascade-wipes `reply_to_content` on any messages that quoted the unsent message |
| `react` | either | Read-modify-write reactions on BOTH rows using a two-phase read-then-write (overflow pre-check on both rows before any write — see §18 and §20.7). Legacy incoming-row backfill: see §22 |
| `react_to_task` | friend of task owner | Patch the task owner's task row with a reaction delta |
| `get_friend_calendar` | friend of calendar owner | Read the owner's visible tasks and categories (filters by `visibility`; verifies friendship) |

Function ID lives in `src/lib/messageDelivery.ts` as `MESSAGE_ACTION_FUNCTION_ID`. All actions live in `appwrite-functions/message-action/main.js`. Friendship is verified before every write. (General cross-user-write rule: see §6.)

### 20.4 Delivery Flow
1. Sender inserts local message with `deliveryStatus: 'pending'`
2. `deliverPendingMessages(userId)` scans for pending outgoing rows
3. Each is sent to `message-action` with `action: 'deliver'`
4. On success: local row patched to `deliveryStatus: 'delivered'`
5. Re-entrancy guarded by module-level `isDeliveryInProgress` boolean; outer loop capped at 5 iterations (§18)
6. Triggered on `AppLayout` mount, `window.focus`, `window.online`, and after every send

### 20.5 Read Receipt Flow
1. Recipient opens `ChatPage`, patches their incoming rows' `readAt` locally (drives unread badge)
2. Calls `markReadOnRemote(partnerId, threadId)` → server patches sender's outgoing rows
3. Sender's polling `forceSync()` in `ChatPage` pulls the update
4. `MessageBubble` renders "✓✓ Seen at [time]" under the last read outgoing message

The polling exists because the sync engine is conservative: it skips the pull phase for rows whose local `_meta.lwt` is newer than the last sync. Two poll cycles is the floor for a read receipt to round-trip without a targeted sync path. The read-receipt cadence is approximately 90–120s worst-case under backoff (30s `ChatPage` poll interval + up to 60s sync backoff cap).

Recipient-side `read_at` propagation depends on `markReadOnRemote` succeeding. If that remote call fails (network drop, Appwrite hiccup), the local patch is already applied but the server never learns the recipient read the thread — the badge will reappear for that thread on a fresh login or second device. The failure is not retried automatically; if it happens repeatedly, cross-device read state will diverge silently.

### 20.6 Unsend Cascade
`unsend` wipes content on both rows AND cascades to any message whose `reply_to_id` matches either the sender's `msg_*` or the recipient's `rmsg_<hash>` id. This makes quotes of an unsent message render as "Message deleted" on both sides. The client also cascades locally in `useMessages.unsendMessage` for immediate feedback.

### 20.7 Message Reactions
`action: 'react'` reads both the caller's row and the peer's row, applies a delta via `applyReactionDelta`, and writes both back. The peer row id is derived locally:
- Outgoing message: `makeRecipientRowId(doc.id)`
- Incoming message: `doc.originalMessageId` (or server lookup if empty)

**Two-phase write (CRITICAL):** the server uses Pass A / Pass B (see §18). Pass A reads both rows, applies `applyReactionDelta` to each, and validates both against `REACTIONS_MAX_LEN`. If either would overflow, the function returns HTTP 400 **before writing anything**. Pass B then writes both. Residual risk: if the second Pass B write fails (network, Appwrite hiccup) after the first succeeded, the pair is partially committed; the next sync cycle reconciles. Rollback was rejected because a third write would introduce its own failure modes. Known limitation, not a bug.

### 20.8 Task Reactions
`action: 'react_to_task'` patches the task owner's task row. Caller must be an accepted friend of the owner. Only `add` operations fire a chat message. Uses the same `reactionUtils` helpers as message reactions.

---

## 21. Chat UI Conventions

- **Gesture direction is role-relative:** incoming bubbles swipe right; outgoing bubbles swipe left. Both reveal a reply icon on the side being uncovered.
- **Timestamp reservation:** bubble status rows (`Delivered`, `Seen at`, timestamp) always occupy their minimum height; visibility is toggled via `opacity`, never presence. This is the specific fix for the hover-flicker feedback loop.
- **Auto-scroll pinning:** `ChatPage` tracks `isPinnedToBottomRef`, updated synchronously in the scroll handler. Incoming messages auto-scroll only when pinned; outgoing always scroll. Scrolling back down sets the flag to true.
- **Scroll-to-bottom FAB:** appears when scrolled >300px from bottom. Green dot indicates unacknowledged messages below. Hidden during search.
- **Search:** local-only, no server round-trip. `Cmd/Ctrl+F` or `Cmd/Ctrl+K` opens; `Esc` or X closes. Filters bubble content, task refs, and reply quotes. Match counter shows `N/M`. Date dividers and gap-timestamps are hidden while searching. Auto-scroll on new messages is suppressed during search.
- **Reply focus:** swipe-to-reply sets the composer's reply context and calls `composerRef.current.focus()` after 50ms (lets the reply-strip render before focus lands).
- **Long-press vs swipe:** movement >8px cancels the long-press timer; movement >30px vertical aborts the swipe and hands off to native scroll (`touch-action: pan-y`).
- **Double-tap ❤️:** fixed emoji, no config. Uses `toggleReaction`.
- **Overlay safety:** when any sheet is open, `gesturesDisabled` is passed to every bubble so swipes don't fire behind the sheet.
- **Unsent bubbles:** all gestures disabled. No reply icon, no action sheet, no double-tap react. Status row still renders for timeline coherence.
- **Reaction timeout toast:** `toggleReaction` (in `useMessages`) returns `'ok' | 'timeout'`. When a reaction is applied optimistically to an outgoing message that stays `deliveryStatus: 'pending'` past the 5s delivery wait, the optimistic patch is reverted and the mutator returns `'timeout'`. All three `ChatPage` reaction call sites (`handleBubbleReact`, `handleReactFromSheet`, `handleEmojiPicked`) branch on this and show the existing toast pattern with the string `"Couldn't send reaction. Try again."`. Do not add new toast infrastructure — reuse the page-level `feedback` state that auto-dismisses after 2000ms.

---

## 22. Task Reactions

- **Storage:** `task.reactions` (already exists in `TaskDocument` and `tasksSchema`). Format: JSON array of `{emoji, userIds}`. Parsed/stringified via `src/lib/reactionUtils.ts`.
- **UI:** Heart button beside the reply button in `FriendDayViewSheet`. Tapping opens `EmojiPickerSheet`. Picking an emoji calls `useFriendCalendar.reactToTask(task.id, emoji)` and, on `add`, `useMessages.sendTaskReaction(task, emoji, color)`.
- **Chat notification:** Emoji is sent as a chat message with a `TaskRefCard`, identical to a task reply. Only on `add` — removes are silent.
- **Chip display:** Reaction chips render below the task title in both `FriendDayViewSheet` (interactive) and the owner's `DayViewSheet` → `TaskItem` (display-only, `onToggle` is a no-op).
- **Optimistic update:** `useFriendCalendar.reactToTask` patches local state first, calls the server, reverts on failure. `patchCachedCalendarTask` persists the server-confirmed value to the friend cache.
- **No self-reactions:** server rejects `callerId === taskOwnerId` with 400.
- **Owner viewing chips:** owners see chips on their own tasks in `DayViewSheet` but cannot toggle them (would need an `remove` op from the owner's side; not implemented).
- **Legacy messages:** message reactions on incoming rows require `originalMessageId`. If empty (pre-V2.4 rows), the server resolves it via `resolveLegacyPeerRowId` on `(sender_id, created_at, content)`. The client persists the resolved id locally so subsequent reactions don't need a lookup.

---

## 23. Auth Architecture

### 23.1 The Provider
- `AuthProvider` (in `src/hooks/AuthProvider.tsx`) is the **single source of truth** for session state. It owns the only `account.get()` call that runs on mount
- `AuthContext` (in `src/hooks/authContext.ts`) holds the context object and the `AuthContextValue` type. It exports no component, which keeps `AuthProvider.tsx` fast-refresh-clean
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
  logout: () => Promise<boolean>;   // UPDATED: was Promise<void>
  updateEmail: (newEmail, password) => Promise<boolean>;
  updatePassword: (newPassword, oldPassword) => Promise<boolean>;
  retry: () => Promise<void>;
}
```

### 23.3 Session Transitions
- **Mount:** `AuthProvider` defers `account.get()` via `queueMicrotask` inside its mount effect. On 401 → `user: null`, `isOffline: false`. On network error → `user: null`, `isOffline: true`, error message set
- **Login:** clears any stale session, creates a new one, calls `account.get()`, updates state, broadcasts a `login` event via `localStorage`
- **Signup:** same as login after the account is created (with the `already active` / `prohibited` swallow for Appwrite's auto-session quirk)
- **Logout:** deletes the session, updates state, broadcasts a `logout` event. Returns `true` on success and `false` on failure. **Callers must gate navigation on the return value**
- **Update email / password:** these do not change session identity; they refresh `user` only

### 23.4 Mid-Session 401 Handling
- Every SDK call that can 401 goes through `guardedCall` from `src/lib/authEvents.ts`. In practice this means every consumer call routes through the guarded SDK surface (`guardedTablesDB`, `guardedStorage`, `guardedFunctions`, `guardedAccount` — see §15). Do not construct raw `TablesDB`/`Storage`/`Functions`/`Account` outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`; ESLint `no-restricted-imports` blocks it.
- Raw `fetch` calls that can 401 (image blob fetches in `storage.ts` and `exportData.ts`) wrap their `fetch` in an outer `guardedCall` and throw `makeUnauthorizedError()` on `r.status === 401`. The error is then caught by `guardedCall`, which dispatches.
- `guardedFunctions.createExecution` normalizes `execution.responseStatusCode === 401` into `makeUnauthorizedError()` before returning — the SDK does not throw on 401 executions, so this step is required for the global dispatch to fire.
- On `isUnauthorizedError(err) === true`, `guardedCall` calls `dispatchUnauthorized()`, which fires the window event `auth:unauthorized`.
- `AuthProvider` listens for `auth:unauthorized` and clears `user`, sets a session-expired error, and lets `AppLayout` redirect to `/login` via its existing `!user` branch.
- Every file in `src/lib/` and `src/db/` that touches the SDK is a consumer of the guarded surface. `src/lib/friendData.ts` additionally throws `FriendAccessError('Unauthorized', 'forbidden')` with `code = 401` on 401 — the `code` is what `guardedCall` keys off; the `FriendAccessError` type is what the friend-calendar UI keys off (it renders `errorKind === 'forbidden'` as "No access"). This dual-purpose is intentional.
- Do not redirect from the call site. Always dispatch and let the provider drive the redirect.

### 23.5 Multi-Tab Auth Sync
- Login and logout both write `JSON.stringify({ type: 'login' | 'logout', at: Date.now() })` to `localStorage` under the key `mosaic_auth_broadcast`
- Every other tab listens via the `storage` event. On `logout`, it clears local user state. On `login`, it re-runs `resolveInitialUser()` to pick up the shared Appwrite cookie
- Never broadcast tokens or credentials — only the event type
- This is not a replacement for server-side session invalidation. It is a UI consistency mechanism

### 23.6 Offline vs Unauthenticated
- **401 from `account.get()`** → definitely not logged in → clear user → `AppLayout` redirects to `/login`
- **Network error / timeout / offline from `account.get()`** → couldn't check → set `isOffline: true`, keep `user: null` → `AppLayout` renders a retry screen (with a `retry()` button) instead of redirecting
- **Any time `navigator.onLine` is false,** `AuthProvider` treats the initial check as "couldn't check"
- `AppLayout` renders three states: `isLoading` → spinner; `!user && isOffline` → retry screen; `!user` → redirect

### 23.7 Things Not To Do
- Do not add `account.get()` calls to a hook or component. If you need session state, call `useAuth()`
- Do not call `account.deleteSession` outside `AuthProvider`'s `logout()` except for the pre-login cleanup inside `login()`
- Do not navigate away from a protected screen on `logout()` failure. Surface an error and stay put
- Do not merge `authContext.ts` into `AuthProvider.tsx` — it will break fast refresh
- Do not treat offline errors as 401. The whole point of `isOffline` is that they're different
- Do not import `TablesDB`, `Storage`, `Functions`, or `Account` from `'appwrite'` outside `src/lib/sdk.ts` and `src/lib/appwrite.ts`. ESLint will reject it, and it defeats the whole point of the guarded surface

---

## 24. Test Suite

### 24.1 Overview
Vitest 3.x, four projects (`unit`, `handlers`, `react`, `components`), 211 tests across 26 files. Config lives in `vitest.config.ts`. Run with `npm test` (or `npm run test:watch` for TDD, `npm run test:ui` for the browser UI). The suite is gated by the installer's verify block (§5.1) — `npm run apply` runs lint → test → build in that order. A failing test blocks a patch from landing.

### 24.2 Project layout
| Project | Environment | Include | Tests |
|---|---|---|---|
| `unit` | node | `tests/unit/**/*.test.ts` | 86 |
| `handlers` | node | `tests/handlers/**/*.test.ts` | 49 |
| `react` | happy-dom | `tests/react/**/*.test.tsx` | 21 |
| `components` | happy-dom | `tests/components/**/*.test.tsx` | 55 |

The `react` and `components` projects load `tests/setup/react.ts` (jest-dom matchers + `afterEach(cleanup)`) and set `NODE_ENV=test` — required by React 19's `act`. The `unit` and `handlers` projects run in plain node with `globals: true`.

### 24.3 Test philosophy — contracts, not internals
Tests assert observable behavior: what a pure function returns, what a hook exposes through its public surface, what side effects a handler triggers on the mock DB, what a component renders for a given prop combination. Tests do NOT assert subscription counts, re-render counts, memoization bail-outs, effect re-fire counts, or RxDB document identity. If a test would break from a pure refactor that preserves external behavior, it is a liability — propose deleting it rather than patching it.

Two documented examples:
- **`useMessages` CONFLICT-retry — not written.** RxDB returns the same document instance from `findOne(id).exec()` on subsequent calls, so a spy-based "throw once, succeed on retry" test couples to RxDB's internal document cache rather than to observable behavior. The retry logic is six lines of if/else and its correctness is covered indirectly by `reactionUtils.test.ts` (delta math) and the `react` handler tests (server-side two-phase commit).
- **`useTaskImage` deferred-revoke — written but flagged.** Hardcodes 1500ms, mirroring `REVOKE_DELAY_MS` in `src/hooks/useTaskImage.ts`. The constant is module-private and not exported; coupling is preferable to weakening the assertion.

### 24.4 Handler helper — `tests/helpers/invoke-handler.ts`
Injects a mocked `node-appwrite` module into `require.cache` via `createRequire`, then `require`s the real `appwrite-functions/message-action/main.js`. The mock provides `Client`, `TablesDB`, `Query`, `Permission`, and `Role`. `makeMockDb()` returns four `vi.fn()` spies (`listRows`, `getRow`, `upsertRow`, `updateRow`); each test queues specific `mockResolvedValueOnce` / `mockRejectedValueOnce` responses per call. `invoke({ userId, body, mockDb })` constructs a synthetic `req` (with the `x-appwrite-user-id` header) and captures `res.json` calls to return `{ body, status, logs, errors }`. This is how every handler action is tested end-to-end without a live Appwrite.

### 24.5 Hook helper — `tests/helpers/testDb.ts`
**The helper deliberately diverges from `src/db/database.ts`.** This is a considered choice, not drift; a long header comment in the file documents the reasoning:

- **No `RxDBDevModePlugin`.** Dev-mode loads a remote iframe from `rxdb.info` on first DB creation. The iframe's script constructs a `BroadcastChannel`, which happy-dom does not implement; the resulting unhandled `ReferenceError` fails the Vitest run even when all assertions pass. Dev-mode's three concrete checks (DB9 `ignoreDuplicate`, DVM1 validator requirement, COL12 migration-strategy count) are all dev-mode-only and catch nothing real in a test environment where every DB is freshly created with a unique name and never migrated.
- **Storage: `wrappedValidateAjvStorage({ storage: getRxStorageMemory() })`.** Same validator production uses; it still validates every write against the schema. Ajv is the meaningful safety net; dev-mode is not.
- **Migration strategies for `tasks` (v1), `friendships` (v1), `messages` (v3)**, mirroring `database.ts`. Strategies are pure pass-throughs / empty-default backfills. **These MUST stay in lock-step with production** — any version bump there requires the same change here, and the §12 migration checklist calls this out.
- **`multiInstance: false`**, unique DB name per `createTestDb()` call (`` `test_${Date.now()}_${Math.random()...}` ``). Parallel test files in separate workers never collide.

Do not add a "test-mode" branch to `src/db/database.ts`. The `vi.mock` pattern in each hook test file is the mechanism.

### 24.6 Hook mock pattern
Vitest hoists `vi.mock` above all imports, and the factory cannot reference imported bindings unless they were declared via `vi.hoisted`. Every hook test file inlines this boilerplate at the top:

```ts
const dbRef = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('../../src/db/database', () => ({
  getDatabase: () => {
    if (!dbRef.current) throw new Error('testDb not initialized');
    return dbRef.current;
  },
}));
```

A shared `tests/helpers/mockDatabase.ts` was considered and rejected: the mock's operation depends on call-site context (which file is doing the mocking), and the shared-ref indirection is less readable than 6 lines of duplication per file.

Lifecycle per hook test file: `beforeEach` → `dbRef.current = await createTestDb()`; `afterEach` → `await destroyTestDb(dbRef.current)`. `useMessages.test.tsx` additionally mocks `../../src/lib/threads` (deterministic thread/recipient ids) and `../../src/lib/messageDelivery` (four network entry points, all `vi.fn().mockResolvedValue`). `useTaskImage.test.tsx` mocks `../../src/lib/storage` and stubs `globalThis.URL.revokeObjectURL`.

### 24.7 Adding new tests
- Pure function → `tests/unit/<name>.test.ts` (node, `globals: true`)
- Appwrite Function action → `tests/handlers/<action>.test.ts` using `invoke-handler.ts`; queue mock responses with `mockResolvedValueOnce`
- Hook → `tests/react/<hookName>.test.tsx` with the mock pattern in §24.6 (skip `testDb.ts` entirely if the hook has no RxDB dependency)
- Component → `tests/components/<ComponentName>.test.tsx` in the `components` project (happy-dom + `@testing-library/react`). Mock `react-router-dom`'s `useNavigate` for components that navigate (`ConversationRow`), and mock `../../src/lib/storage` for components that render images (`ConversationRow`, `UserResultCard`, `CategorySection`). Prefer asserting on rendered text/labels and firing user events over asserting on internal state.

### 24.8 Regression comments
Tests that pin behavior documented in this file carry a `// Regression: §<section> (<contract name>)` comment. Examples: `// Regression: §20.5 (unread badge contract)`, `// Regression: §10 (CONFLICT Is Not an Error)`, `// Regression: §16 (conversation list sort)`. When the referenced section changes, the test author is expected to review the test — the comment is a pointer, not enforcement.

---

## Changelog

| Date | Section(s) | Change | Source |
|---|---|---|---|
| 2026-09-15 | §4, §8, §9, §10, §15, §18, §19, §23 (new) | Introduced `AuthProvider` as single source of truth for session state; `useAuth` became a consumer shim; `logout()` now returns `boolean`; global `auth:unauthorized` event for mid-session 401; multi-tab `storage` broadcast; offline retry screen; sync kicks off after login | Bug Audit: Auth Context & Shared Session Architecture |
| 2026-09-15 | §9, §10, §15, §18, §23.4–23.7 | Added `guardedCall` helper to centralize 401 dispatch; `isUsernameAvailable` returns `null` on 401; retry screen escape hatch + backoff + offline/online copy; `logout()` JSDoc; changelog added | Auth Lifecycle Concern Closure |
| 2026-09-15 | §5.1 (new), §15 | Added mega-file revision workflow: single `mosaic` fenced block + `apply-changes.mjs` installer with backup, lint, build, and rollback. Documented npm scripts and the emission template appended to future prompts | Revision Workflow Tooling |
| 2026-09-15 | §5.1, §18 | Switched outer mega-file fence from backticks to tildes; installer regex now accepts both and requires a length-matched closing fence. Inner backtick fences in file content no longer break delivery. Added local-dirty-wins conflict semantics to §18 | Revision Workflow Tooling |
| 2026-09-15 | §4, §8, §9, §20.3, §20.5 | Backlog cleanup: `message-action` scope annotation, Phase 2 chronological reorder, drop React parenthetical, legacy peer cross-ref to §22, read-receipt cadence note | Backlog Closure Batches 1–7 |
| 2026-09-16 | §6, §8, §10, §11, §15, §18, §20.3, §20.7, §21, §23.4, §23.7 | Backlog Closure 1–7 follow-up: documented fence-aware parser (§5.1); `Parameters<T>` overload trap (§6); `msg_` prefix server guard (§11); `makeUnauthorizedError` helper (§10, §15); `sdk.ts` guarded surface + ESLint enforcement (§15); bounded delivery loop and two-phase read-then-write race safety (§18); `mark_read` body shape and `handleReact` two-phase write (§20.3, §20.7); reaction timeout toast (§21); raw-SDK import restriction (§23.4, §23.7); corrected ChatPage poll interval in §18 from "10s" to "30s" to match code | Backlog Closure Batches 1–7 (post-ship doc sync) |
| 2026-09-16 | §20.5 | Corrected read-receipt worst-case from "~60s" to "90–120s (30s `ChatPage` poll interval + up to 60s sync backoff cap)". Matches shipped code (ChatPage poll = 30s, sync backoff cap = 60s). Decision: keep code, fix doc — pushing poll back to 15s to hit 60s was rejected as 429 rate-limit risk | Post-backlog doc/code reconciliation |
| 2026-09-16 | §16 | Added "Calendar Rendering Pipeline (perf invariants — do not regress)" bullet documenting slide windowing (`renderStart`/`renderEnd`), the `tasksByDate` Map, memoized `MonthView`/`WeekView` day arrays, memoized `DayCell` prop contract, memoized `CalendarBody`, friend-calendar activation refetch throttle, ref-counted `useTaskImage` object URL cache, and manual windowing in `DayViewSheet`/`HomePage` | Bug Audit: Calendar Rendering Performance |
| 2026-09-16 | §5.1 | Rewrote fence rules to distinguish 4-tilde outer fence from 3-tilde/3-backtick inner fences. Added "Common pitfalls" subsection covering the four failure modes. | Post-audit doc clarity |
| 2026-09-16 | §18 | Added "Mounted Pane Freshness" rule — mounted panes displaying externally-changeable cached data must refetch on activation, throttled by a minimum interval. Reference: PersonPane's friend-pane activation refetch (`FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`). | Calendar perf audit follow-up |
| 2026-09-16 | §8, §15 | Marked Calendar Perf Audit complete in Current Progress. Removed `CalendarView.tsx`, `ViewContainer.tsx`, `DiaryView.tsx`, `TodoListView.tsx` from the codebase (dead code — no importers, no routes). §15 file-organization list unchanged (never named them). | Calendar perf audit follow-up |
| 2026-09-16 | §5.1, §8, §10, §12, §15, §24 (new) | Test Suite Layers 1–4 shipped: 152 tests across 15 files in three Vitest projects (`unit`, `handlers`, `react`). Installer verify block now runs `npm test` between lint and build (§5.1), gating every apply on green tests. ESLint `no-empty` relaxed with `allowEmptyCatch: true` to permit intentional silent-catch cleanup (§10, §15). §12 migration checklist now names `tests/helpers/testDb.ts` as a lock-step site. New §24 documents project layout, philosophy (contracts not internals), handler helper, hook helper (including its deliberate divergence from `src/db/database.ts`), the `vi.hoisted` mock pattern, and how to add new tests. | Test Suite Layers 1–4 |
| 2026-09-16 | §8, §15, §24 | Test Suite Layer 5 shipped: `components` Vitest project (happy-dom + `@testing-library/react`) with 55 tests across 10 component test files (`BottomSheet`, `CategorySection`, `ChatSearchBar`, `ConversationRow`, `MessageBubble`, `MessageComposer`, `ReactionRow`, `TaskActionSheet`, `TaskVisibilitySheet`, `UserResultCard`). Totals now 211 tests across 26 files in four projects (`unit` 86, `handlers` 49, `react` 21, `components` 55). §24.1 overview, §24.2 project table + setup-file note, §24.7 "Adding new tests" (component entry), §8 progress line, and §15 `tests/` annotation all updated to reflect four projects. §24.3 philosophy extended to explicitly cover component tests. | Test Suite Layer 5 |

Sections added or rewritten in bulk should be flagged in the changelog with `(new)` and listed on every subsequent edit that touches them.
