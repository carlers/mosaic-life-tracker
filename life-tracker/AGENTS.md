# PROJECT_CONTEXT.md

## 0. Hard Rules

1. RxDB schemas: never `deleted` — use `isDeleted` (§12)
2. Never hard-delete; `isDeleted: true` (§7)
3. Row IDs ≤36 chars, `[a-zA-Z0-9_]+`, no leading `_` (§6, §11)
4. Existing remote rows: `updateRow`; new rows: `createRow`; 404 fallback on `updateRow`: `createRow`, never `upsertRow` (§6)
5. Outgoing messages: `read_at` is server-owned; omit on push (§12)
6. Message IDs must start with `msg_` — server-enforced (§11)
7. Cross-user writes go through Appwrite Functions, never direct client writes (§6, §20)
8. 401 from `account.get()` = "not logged in"; network error = "couldn't check" — never conflate (§10, §23.6)
9. Mega file: outer fence exactly five tildes + `mosaic`; inner fences ≤3 chars (§5.1)

## 1. The Vision
- An offline-first, local-first, self-hostable "Life Tracker" PWA
- **Phase 1:** A pixel-perfect, highly polished clone of "Todo Mate" (tasks, categories, social calendar, diary) to replace an ad-filled app
- **Phase 2:** Optional, modular integrations for fitness, media, and personal CRM
- **Phase 3 (extension beyond Todo Mate):** 1:1 messaging with friends, message reactions, and task reactions — a native social layer woven into the calendar
- **Core UX:** A unified, dark-mode calendar view that aggregates all life data, featuring 0ms load times (via RxDB), bottom-sheet interactions, and 100% offline functionality. Cloud is strictly for background sync

## 2. Product Reference: The "Todo Mate" Clone (Phase 1)

A dark-mode calendar clone of Todo Mate. Shipped: tasks, categories, month/week calendar, day sheet, person carousel, social calendar, 1:1 messaging, message + task reactions. Planned: Todo List view, Diary view, Notifications tab. Messaging/reactions are a Mosaic addition, not in the reference app (see §20).

**ARCHITECTURAL RULE:** every Category and Diary document carries a `visibility` field (`public`, `followers`, `private`). Appwrite RLS is avoided by server-mediated reads (`get_friend_calendar`) and server-mediated cross-user writes (`message-action`). See §6 and §20.

**Behavioral specs for planned views (governs Phase 3.5–3.7):**
- **Todo List view:** compact, color-only calendar grid. Clicking a colored dot "selects" that day; scrolling down reveals a vertical list of tasks for the selected day. No task titles on the grid — color-only.
- **Diary view:** per-day free-text entry, keyed by `yyyy-MM-dd`. Visibility field per entry. Renders in the same view-switcher slot as Calendar.
- **Notifications tab:** in-app notifications for message and reaction events. Renders a full `<ComingSoon />` page until wired.
- **Calendar layout alignment (permanent):** Month and Week views must be perfectly vertically aligned — same header spacing, `auto-rows-fr` on grids. Switching Month → Week jumps to the week containing the 1st of that month. Week header renders "Aug 30 - Sep 5, 2026" on a single line. Task blocks fill the full grid-cell width with `px-1.5` margins, `rounded-[3px]` corners, and `overflow-hidden whitespace-nowrap` (NEVER truncate or `...`). Completed tasks show category color; uncompleted are `bg-[#374151]` / `text-gray-400`. Saturdays `text-blue-500`, Sundays `text-red-500`, today has a blue circle border.

For product-spec detail beyond the above (aesthetic descriptions, reference-app parity notes), Chat 1 may request `npm run dump -- PRODUCT_NOTES.md` if that file exists; otherwise the above is authoritative.

## 3. Strict Constraints
- **Budget:** $0 for AI tools. $0 for Apple (relying on PWA "Add to Home Screen"). $25 one-time for Google Play (later)
- **Hosting:** Free managed cloud initially (Appwrite Singapore), easily self-hostable on a home NAS via Docker later
- **Performance:** Must load instantly (0ms) and work 100% offline
- **Mobile PWA Testing:** Local IP testing often fails due to Appwrite CORS and mobile OS SSL restrictions for background Service Worker API calls. Always use Cloudflare Tunnels (`cloudflared tunnel --url http://localhost:5173`) for reliable mobile testing, and whitelist the tunnel URL in Appwrite Platforms

## 4. The Locked Tech Stack
- **Frontend:** Vite + React 19 (TS) + React Router v7 + Tailwind CSS v3 + lucide-react + date-fns
- **Media & UI:** `browser-image-compression` (max 150KB base64), `emoji-picker-react` (used by message + task emoji pickers)
- **Local DB & Sync Engine:** RxDB v17 (`getRxStorageDexie` + `wrappedValidateAjvStorage`). **CRITICAL:** we do NOT use the `replicateAppwrite` plugin. Custom REST sync engine (`src/db/sync.ts`) calls the Appwrite TablesDB API directly.
- **Backend:** Appwrite TablesDB (SDK v26+).
- **Backend Functions:** `message-action` (Node.js 18) handles all cross-user writes for messaging and task reactions. Actions enumerated in §20.3. Required scopes: `rows.read`, `rows.write`, `tables.read`. `tables.write` intentionally absent — add only if Appwrite docs/Console require it for cross-user `upsertRow`/`updateRow`.
- **PWA:** `vite-plugin-pwa` (`registerType: 'autoUpdate'`)
- **Auth:** React Context (`AuthProvider`) is the single source of truth for the authenticated user. See §23. `useAuth` is a thin consumer shim; no hook mounts its own `account.get()`.

## 5. The "Brain Generates, Human Executes" Workflow
- **AI Role:** The AI writes 100% of the production-ready code. No local AI agents are used for coding
- **Human Role:** The user manually creates files, pastes the AI's code, and runs terminal commands
- **Code Generation Rules:** The AI must output complete, copy-pasteable files (no `// ... rest of code` placeholders). Files should be organized by logical separation, not arbitrary line limits

## 5.1 Revision Workflow (Mega File + Installer)

All revisions are delivered as a single fenced code block tagged `mosaic`. Outer fence: exactly five tildes + `mosaic` opener; five tildes alone on the closer. Installer regex: `/^(~~~+|`{3,})mosaic\s*\n([\s\S]*?)\n\1\s*$/` — the `\1` backreference requires the closing fence to match character AND length exactly, so a five-tilde opening can only be closed by exactly five tildes and any ≤3-char fence inside is inert. (The regex accepts any length ≥3; four is the convention, not a hard maximum.)

**Mega-file shape** (this is a shape illustration only — do NOT copy-paste the opener; the real opener is written exactly once at the top of your output):

```
<opener: five tildes immediately followed by the literal `mosaic`, nothing else on the line>
===FILE:path/to/file.ext===
<complete file content>
===FILE:path/to/other.ext===
<complete file content>
===DELETE:path/to/removed.ext===
===COMMIT:audit: auth context and shared lifecycle===
<closer: five tildes alone on their own line>
```

The literal string `mosaic` appears **exactly once** in a well-formed mega file: immediately after the five-tilde opener. If you find yourself writing it a second time, you have copied the shape illustration into your output — delete that line before emitting.

**Fence rules:**

1. **OUTER fence** wraps the mega file. Opens with exactly five tildes immediately followed by `mosaic` (no space). Closes with exactly five tildes alone on their own line. Always five tildes — never three, never backticks, never mixed character or length.
2. **INNER fences** — anything inside file contents (code examples, Markdown snippets, TypeScript blocks, prose examples). Any fence character and any length up to three characters is fine. The parser treats them as inert because their character and/or length differs from the outer fence. Content inside an inner fence is literal: `===FILE:` / `===DELETE:` / `===COMMIT:` lines inside it are not directives.
3. The parser strips the outer fence first (regex above), then scans the remaining content line-by-line with CommonMark fence rules, tracking which lines sit inside an inner fence. Only lines not inside an inner fence can be directives.

**Additional rules:**

- One fenced block per logical change. No prose before or after (aside from a single confirmation line).
- Full file contents only — no diffs, no placeholders, no elisions.
- Directives (`===FILE:`, `===DELETE:`, `===COMMIT:`) must be at line start, exactly as shown.
- Do not escape content. Do not nest `mosaic` blocks.
- `===COMMIT:...===` is optional. If absent, the installer emits a generic fallback based on the touched paths.
- **Reasoning discipline before emission:** if the mega file touches ≥2 files, Chat 2 first emits a single `npm run dump -- <paths>` line listing every file whose current content it needs (see §25.5.1). Do not interleave dumps and emission.

The user pastes the block into `pending-changes.txt` (project root, gitignored), then runs one of:

| Command | Purpose |
|---|---|
| `npm run apply:dry` | Parse + validate, no writes |
| `npm run apply` | Write files, lint, test, build, then prompt to commit |
| `npm run apply:docs` | Write files, skip lint/test/build |
| `npm run apply:start` | Write, lint, test, build, start dev server |
| `npm run apply:rollback` | Restore from the most recent backup |

The installer (`apply-changes.mjs`) backs up every modified or deleted file to `.mosaic-backup/<timestamp>/` before writing. On lint, test, or build failure it exits without restoring; the user runs `npm run apply:rollback` explicitly to revert. `apply-changes.mjs` copies its full run output to the clipboard on exit (all modes, success or failure).

**Git commit prompt (apply only, after green verify).** When `npm run apply` passes lint, test, and build, the installer prompts `Commit these changes? [Y/n]`. On Y it runs `git add` for the touched paths only (never `-A`, so unrelated WIP is not swept in), commits with the `===COMMIT:...===` message (truncated to 72 chars; fallback from touched paths if absent), and prints the resulting hash. On n it stops. Skipped entirely if stdout is not a TTY (piped or CI) — the installer instead prints a copy-pasteable `git add … && git commit -m "…"` line. Flag overrides: `--commit` (skip the prompt, always commit on green) and `--no-commit` (skip the prompt, never commit). A failed `git commit` (e.g. a pre-commit hook rejects) exits non-zero but does **not** trigger rollback — files are already written.

**Parser is fence-aware (CRITICAL).** `parseMegaFile` runs a two-pass scan:

1. Pass 1 marks every line inside a Markdown fence (backticks or tildes; CommonMark rules). Fence-boundary lines are marked "inside".
2. Pass 2 performs the linear directive scan but refuses to match any directive on a line marked "inside".

Without this guard, directive examples inside fenced blocks would truncate the enclosing file at the first example directive, create phantom files, and override the outer `===COMMIT:...===`.

**Mega-file emission checklist (Chat 2, before emitting):**

- Outer fence is exactly five tildes + `mosaic` at the top; five tildes alone at the bottom. Nothing before, nothing after.
- The literal `mosaic` appears exactly once.
- Every touched file is present as a `===FILE:path===` block with its complete new content. Full contents — no diffs, no placeholders.
- `===FILE:path===`, `===DELETE:path===`, and `===COMMIT:...===` are at line start, exactly as shown.
- `SESSION_STATE.md` is updated as the last `===FILE:` block before `===COMMIT:`.
- No prose, no announcement, no reasoning inside the fence. The mega file contains files only.

---

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
- **Bottom Sheet Standardization:** All modals MUST use `<BottomSheet>` (see §13). It MUST use `ReactDOM.createPortal` into `document.body` to escape parent z-index/overflow traps and sit above `BottomNav`. Drag-to-close is restricted to the header handle via Framer Motion `useDragControls` + `dragListener={false}` on the main container — prevents accidental closes while scrolling.
- **Sticky Layout Rules:** `MainLayout` root must be `h-screen overflow-hidden`; `<main>` must be `flex-1 overflow-y-auto`. Without both, `position: sticky` misbehaves.
- **Non-Sticky Home Chrome:** On Home, the person carousel, profile header, `TopBar`, and calendar date header are intentionally NOT sticky — they scroll away so the calendar grid owns the viewport. Do not re-add `sticky top-0`.
- **Layout-Shift Reservation:** Any element whose visibility toggles (timestamps, status rows, hover controls) MUST always reserve its space — toggle opacity, never presence. Prevents the hover-flicker reflow loop.
- **Gesture Priority on Interactive Elements:** swipe > long-press > double-tap > single-tap. Single-tap is deferred ~300ms to distinguish from double-tap. Any tap on the same pointer sequence as a swipe or long-press MUST be suppressed via a flag on the gesture hook (see §21).
- **RxDB Reserved Keywords:** NEVER use `deleted` as a field name in RxDB schemas (see §12).
- **Soft Deletes:** Never hard delete. Always `isDeleted: true` for RxDB tombstones (§0 item 2).
- **Strict ISO Dates:** All date fields MUST be ISO 8601 strings (`yyyy-MM-dd` for day keys, full `.toISOString()` for timestamps).
- **iOS Storage:** Must call `navigator.storage.persist()` on launch to prevent WebKit from purging IndexedDB.
- **Coming Soon:** Bottom nav has 5 tabs: Home, Explore, Notifications, Messages, Account. Notifications renders a full `<ComingSoon />` page.

## 8. Current Progress & State (As of Latest Build)

- **Foundation & primitives complete (Phases 1.1–2.6):** App layout, primitives, `BottomSheet` (Portal + drag controls), auth flow, PWA config, React Router, Home shell, view memory, month/week calendar, day sheet + task CRUD, category manager, `useCategories`. Conventions hardened (`window.confirm` eliminated, iOS focus fixed, row-permission correctness verified, `updateRow` vs `upsertRow` semantics enforced).
- **Social graph & friend calendar complete (Phase 3.0):** Explore page (search, requests, accept/decline/cancel, block/remove), `useFriends`/`useProfileLookup`/`useMyProfile`, `SetUsernameSheet`. `FriendCalendarPage` + `FriendCalendarView` (Embla carousel) + `FriendDayViewSheet` + `useFriendCalendar` + `friendData`/`friendCache` (5-min TTL) + `get_friend_calendar`.
- **Messaging, reactions, chat polish complete (Phases 3.1–3.3):** `messages` collection (v3) two-row pattern, `message-action` function (`deliver`/`mark_read`/`unsend`/`react`/`react_to_task`/`get_friend_calendar`), `useMessages`/`useConversations`/`useUnreadMessages`, `MessagesPage`/`ChatPage` + full chat component set, outbox delivery, deterministic thread/recipient IDs, shared `reactionUtils`. Swipe-to-reply, double-tap ❤️, single-tap timestamp, unified `useBubbleGestures`, read receipts, scroll FAB, chat search. Task reactions via heart button + emoji picker.
- **Architecture hardening complete:** `AuthProvider` context as single source of truth (single `account.get()` per load; global `auth:unauthorized` dispatch; multi-tab broadcast; offline retry screen). Calendar perf audit (slide windowing, memoized `tasksByDate`, memoized `DayCell`, ref-counted `useTaskImage`). Conversations/unread refactor (single providers, thin selectors, `isUnsent` exclusion). Sync engine audit (13 slices; `createRow` 404 fallback; `messageActionQueue`; drift detection; `updatedAt` on categories/settings). Offline write resilience (`socialOutbox`). See §16, §18, §23 for invariants.
- **Phase 1 audits closed (2026-09-17):** Offline behaviour, realtime subscriptions (all six tables), error boundaries (root + per-route), image-cache consolidation, PWA/SW audit, four-part accessibility sweep. Sole carry-over: OFF-1 (offline auth gate, H1 = Option A), scheduled Phase 2 batch 2.1.
- **Phase 2 refactor audit → refactor closed (2026-09-18):** Batches 2.1–2.10 shipped. OFF-1 offline auth gate (H1 = Option A); duplication sweep (DUP-1…12); component boundary audit (CB-1…14); hook boundary audit (HB-1…12); lib-level extractions; shared React primitives + `useRxCollection`; sheet migrations across 19 files; domain hook extractions (useThreadMessages/useMessageActions/useConversations/useUnreadMessages split); god-component splits (CalendarBody, DayViewSheet, ChatPage, PersonPane); cleanup pass. All findings closed. See SESSION_STATE.md for per-batch decisions.
- **Test suite live:** 390 tests across four Vitest projects (`unit`, `handlers`, `react`, `components`). Installer gates every apply on green tests (§5.1). See §24.

**Next Up:** Phase 3 — optimize audit → optimize (bundle size 1.7 MB, route splitting, lazy images; receives OFF-6 LRU cap). Then Phase 4 spec audit group. Then Phase 3.5–3.7 feature work. Full history lives in the Changelog (index rows; see §26 for the row format).

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
- `src/lib/imageCache.ts` — **single owner of the IndexedDB blob cache for downloaded image files** (keyed by `fileId`). `storage.ts` and `exportData.ts` consume it via `getCachedImage`/`cacheImage`/`deleteCachedImage`; do not open the cache DB directly elsewhere. No eviction bound (see §18 Accepted Limitations).
- **Service-worker scope.** `vite-plugin-pwa` owns the SW registration (root scope, `registerType: 'autoUpdate'`). Do not register a second SW, do not expand scope beyond root, and do not precache user-generated content — only the app shell. The SW is production-only; dev mode does not register one (Vite HMR and a live SW would fight each other).
- `scripts/` — build-time utilities: `dump-files.mjs` (Tier 2 dump, §25.2), `clipboard.mjs` (shared clipboard helper), one-off Appwrite migration scripts.
- `tests/` — Vitest suite (four projects). See §24.
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
4. **Calendar slides are windowed.** `useCalendarState` exposes `renderStart`/`renderEnd` from Embla `scrollProgress` + `focusDate` index, expanded by `RENDER_WINDOW = 2`. `CalendarBody`/`FriendCalendarView` render slide content only inside the window; all 61 (or 25) slide containers remain emitted so Embla geometry is unchanged. Do not un-window.
5. **Tasks are indexed once.** `CalendarBody`/`FriendCalendarView` compute `tasksByDate: Map<string, TaskDocument[]>` via `useMemo` keyed on `tasks`; pass the Map (not the array) into `MonthView`/`WeekView`; `DayCell` receives a per-day slice. Never reintroduce a per-day `.filter()`.
6. **`MonthView`/`WeekView` memoize their day arrays.** `calendarDays`/`weekDays` are `useMemo`-ized on `focusDate` so each `DayCell`'s `date` prop is referentially stable — without it `React.memo` on `DayCell` never bails.
7. **`DayCell` is memoized and prop-stable.** Receives `date` (stable), `tasks` (Map slice, `EMPTY_TASKS` for empty days), `categories` (parent `useMemo`), `isCurrentMonth` (primitive), `onDayClick` (parent `useCallback`). Builds its click closure internally. Sorting runs only when `tasks.length > 1` and is memoized on `tasks`.
8. **`CalendarBody` is memoized.** `PersonPane` re-renders on toast/`activeView` changes; `CalendarBody` bails via `React.memo` unless a stable prop changed.
9. **Friend-calendar refetch on activation.** `PersonPane` forces `refetchFriendCalendar(true)` when a friend pane becomes active, throttled by `FRIEND_REFETCH_MIN_INTERVAL_MS = 15_000`. Own pane stays live via RxDB subscription. Do not rely on cache TTL alone.
10. **`useTaskImage` shares object URLs.** Module-level `Map<fileId,{url,refCount,revokeTimer}>` ref-counts URLs across hook instances with a 1.5s deferred revoke so StrictMode double-mounts, Month↔Week toggles, and slide re-entry don't tear down + re-read. Do not bypass with a direct `getLocalImageUrl` in calendar cells.
11. **`DayViewSheet`/`HomePage` use manual windowing.** `RENDER_WINDOW = 3` for `DayViewSheet`, `RENDER_WINDOW = 1` for `HomePage`. Load-bearing for scroll smoothness.
12. **One subscription per collection, one provider per collection.** `ConversationsProvider` (mounted in `AppLayout`) is the sole owner of the inbox `db.messages` subscription and the sole caller of `useFriends()` for badge/chat-list. `FriendsProvider` (mounted above it) owns the `db.friendships` subscription. `useConversations`/`useUnreadMessages`/`useFriends` are thin context selectors — they MUST NOT mount their own RxDB subscriptions.
13. **Unread math excludes `isUnsent`.** Counter is `direction === 'incoming' && !readAt && !isUnsent` — required for consistency with `ChatPage`'s own unread check. Regression tests pin this.
14. **Conversation grouping is by counterpart, not thread.** Groups by the other participant id (`senderId === userId ? recipientId : senderId`). Relies on `makeThreadId` being a pure function of the participant pair. Do not introduce rows whose `threadId` is not derived from `senderId`/`recipientId`.
15. **`lastMessage` depends on RxDB sort order.** Inbox `lastMessage` is `msgs[0]`, correct only because the provider queries `sort: [{createdAt:'desc'}]`. Do not drop that sort in favor of client-side sorting.
16. **`ConversationRow` is memoized with a custom comparator.** Keys on `threadId`, `unreadCount`, friend identity (`friendId`, `friendDisplayName`, `friendUsername`, `friendAvatarFileId`), and the `lastMessage` fields that affect rendering (`id`, `content`, `taskRefTitle`, `direction`, `createdAt`, `isUnsent`). Any new rendered field MUST be added to the comparator or the memo swallows the update.

## 17. Native Input Quirks
- **Dark theme `<input type="date">`:** MUST include `[color-scheme:dark]` Tailwind arbitrary class, else the native picker renders light-theme.
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
- **Image cache has no eviction bound.** `src/lib/imageCache.ts` stores downloaded image blobs in IndexedDB keyed by `fileId` with no LRU cap or byte budget. `deleteCachedImage` removes a blob when its owning entity is deleted on this device, but orphaned blobs (entities deleted on another device, failed exports, or aborted uploads) accumulate. Rejected fix: an LRU cap needs per-entry access timestamps plus a per-device byte budget; images are ≤150KB post-compression and typical usage is dozens, not thousands. A Phase 3 optimize-batch can add an LRU sweep with a byte budget. Until then, users with very large libraries may see IndexedDB growth over time. Revisit if a user reports quota errors.

## 19. Bootstrap & Persistence
1. `main.tsx` order: `navigator.storage.persist()` → `initializeDatabase()` → fire-and-forget `initializeSync()` (never block render on network) → `ReactDOM.createRoot(...).render(<React.StrictMode><AuthProvider><App /></AuthProvider></React.StrictMode>)`.
2. `initializeSync()` is always `.catch()`-wrapped — a sync failure must never prevent mount.
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
- **Reply focus:** swipe-to-reply sets the composer's reply context and calls `composerRef.current.focus()` after 50ms (lets the reply-strip render first).
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
Vitest 3.x, four projects (`unit`, `handlers`, `react`, `components`), 390 tests across four projects. Config in `vitest.config.ts`. Run `npm test` (or `npm run test:watch` / `npm run test:ui`). Gated by the installer's verify block (§5.1) — `npm run apply` runs lint → test → build. A failing test blocks a patch from landing.

### 24.2 Project layout
| Project | Environment | Include |
|---|---|---|
| `unit` | node | `tests/unit/**/*.test.ts` |
| `handlers` | node | `tests/handlers/**/*.test.ts` |
| `react` | happy-dom | `tests/react/**/*.test.tsx` |
| `components` | happy-dom | `tests/components/**/*.test.tsx` |

The `react` and `components` projects load `tests/setup/react.ts` (jest-dom matchers + `afterEach(cleanup)`) and set `NODE_ENV=test` — required by React 19's `act`. The `unit` and `handlers` projects run in plain node with `globals: true`.

### 24.3 Test philosophy — contracts, not internals
Tests assert observable behavior: what a pure function returns, what a hook exposes through its public surface, what side effects a handler triggers on the mock DB, what a component renders for a given prop combination. They do NOT assert subscription counts, re-render counts, memoization bail-outs, effect re-fire counts, or RxDB document identity. If a test would break from a pure refactor that preserves external behavior, it is a liability — propose deleting it rather than patching it. Rationale and two documented examples (`useMessages` CONFLICT-retry not written; `useTaskImage` deferred-revoke written + flagged) live in the Changelog.

### 24.4 Handler helper — `tests/helpers/invoke-handler.ts`
Injects a mocked `node-appwrite` module into `require.cache` via `createRequire`, then `require`s the real `appwrite-functions/message-action/main.js`. The mock provides `Client`, `TablesDB`, `Query`, `Permission`, and `Role`. `makeMockDb()` returns four `vi.fn()` spies (`listRows`, `getRow`, `upsertRow`, `updateRow`); each test queues specific `mockResolvedValueOnce`/`mockRejectedValueOnce` responses per call. `invoke({ userId, body, mockDb })` constructs a synthetic `req` (with the `x-appwrite-user-id` header) and captures `res.json` calls to return `{ body, status, logs, errors }`. Every handler action is tested end-to-end without a live Appwrite.

### 24.5 Hook helper — `tests/helpers/testDb.ts`
**The helper deliberately diverges from `src/db/database.ts`.** Considered choice, not drift; a long header comment in the file documents the reasoning. Summary:
- **No `RxDBDevModePlugin`** — dev-mode loads a remote iframe from `rxdb.info` on first DB creation; its `BroadcastChannel` is unimplemented in happy-dom and the unhandled `ReferenceError` fails the run even when assertions pass. Dev-mode's checks are dev-mode-only and catch nothing real in a fresh, unique-named, never-migrated test DB.
- **Storage:** `wrappedValidateAjvStorage({ storage: getRxStorageMemory() })` — same validator production uses; Ajv is the meaningful safety net, dev-mode is not.
- **Migration strategies for `tasks` (v1), `friendships` (v1), `messages` (v3), `categories` (v1), `settings` (v1)**, mirroring `database.ts`. Strategies are pure pass-throughs / empty-default backfills. **These MUST stay in lock-step with production** — any version bump there requires the same change here, and the §12 migration checklist calls this out.
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

## 25. AI Workflow Protocol

### 25.1 Roles
Three roles participate. Every chat session is exactly one role.

- **Chat 0 — User / Arbiter.** The human. Makes product decisions, runs terminal commands, approves plans, is the only party who can change scope. Not a chat session.
- **Chat 1 — Brain.** Planner, auditor, prompt generator. Reads `AGENTS.md`, `SESSION_STATE.md`, and the attached `repomix --compress` output. Produces prompts for Chat 2 and plan updates. Does NOT write production code. May request exact file contents via `npm run dump -- <paths>`. **A single Chat 1 session spans the full audit cycle** — brief → dumps → findings → Chat 2 fix prompt — without handing off. Only a user-typed `OFFBOARD` triggers a handoff (§25.6); Chat 1 never hands off on its own initiative. **Chat 1 may emit its own mega files for documentation-only changes (§25.6).** All runtime-affecting changes — TypeScript, scripts, configs, `package.json`, anything that could affect runtime behavior — go through Chat 2. Follows §25.9.
- **Chat 2 — Hands.** Coder, mega-file producer. Reads `AGENTS.md`, `SESSION_STATE.md`, and the attached `repomix --compress` output. Produces exactly one mega file per §5.1 for the current batch. Updates `SESSION_STATE.md` inside every mega file. Requests exact files via `npm run dump -- <paths>`. Follows the question policy (§25.5) and §25.9.

A session declares its role in its first message (§25.4). If it does not declare a role, it must ask before acting.

### 25.2 Context Tiers
Use the lowest tier that supports the task.

| Tier | Contents | When |
|---|---|---|
| **Tier 0** | `AGENTS.md` + `SESSION_STATE.md` | Always. Both are included in any repomix of the repo, so no separate action is needed if you send any repomix at all |
| **Tier 1** | `repomix --compress` | **Default for both chats.** ~54k tokens. Compressed file-tree + skeleton view of every file. Sufficient for planning, audits, and most edits |
| **Tier 2** | `npm run dump -- <paths>` | On demand. Requests exact full-file contents for specific paths. Emits each file wrapped in a repomix-compatible `<file path="…">…</file>` block and copies to clipboard |
| **Tier 3** | Full `repomix` (uncompressed) | Rare. Only for brand-new Chat 1 onboarding or a full-repo audit that genuinely needs every line. ~200k tokens |

**Rules:**
- Default context for every chat is `repomix --compress`. Full repomix is the exception, not the baseline.
- When a chat needs exact file contents, it outputs the request inside a tilde fence (five tildes by default) so the line is copy-pasteable as a single unit. Dump output uses repomix's XML `<file path="…">` wrapper, **not** the `===FILE:…===` directive syntax — deliberately distinct so a dump can never be mistaken for (or accidentally parsed as) a mega file.
- Compressed repomix does not alter Markdown files (`AGENTS.md`, `SESSION_STATE.md`), so Tier 0 is always delivered in full regardless of the tier chosen.

### 25.3 Session State
`SESSION_STATE.md` lives in the repo root and is included in every repomix. Single source of truth for "where are we now."

| Field | Meaning |
|---|---|
| `Updated` | ISO timestamp of the last real change. Do not bump on re-emission if unchanged |
| `ActivePlan` | The current phase or major workstream |
| `CurrentBatch` | The current batch within the plan, as `N of M` |
| `CurrentTask` | The specific task inside the current batch |
| `Status` | One of: `not_started`, `in_progress`, `blocked`, `audit_closed` |
| `NextAction` | One line: what the next chat should do. Chat 1 fills this in when planning; Chat 2 refines it at the end of every mega file |
| `NextChatRole` | `chat1` or `chat2`. Tells the offboarding prompt which role the next session should assume. Not a directive to start a new session |
| `BatchPlan` | Checklist of the current plan's batches, `[x]` for done. Kept short — no deeper than one level |
| `OpenQuestions` | Unresolved questions blocking Chat 2 under §25.5. `none` when clear |
| `Findings` | (optional) One line per finding: ID, severity, one-sentence description, fix direction. Absent when no open findings |
| `Decisions` | (optional) One line per non-obvious decision: date, what was decided, rationale, disposition. Absent when nothing worth recording |
| `Deferred` | (optional) Items routed to other batches/phases, with the target named. Absent when nothing is deferred |
| `LastApply` | ISO timestamp of the most recent successful `npm run apply` |
| `LastAuditSummary` | One line: outcome of the last audit or completed batch |

**Who updates it:**
- **Chat 1** writes the initial `ActivePlan`, `BatchPlan`, and `NextChatRole` when starting a new phase.
- **Chat 2** updates `CurrentBatch`, `CurrentTask`, `Status`, `NextAction`, and the relevant `[x]` in `BatchPlan` inside every mega file it emits. The update is a `===FILE:SESSION_STATE.md===` block at the end of the mega file, before the `===COMMIT:...===` directive.
- **Chat 1** updates `LastAuditSummary` and `ActivePlan` when a phase closes or a new phase opens. Chat 1 also owns `Findings`, `Decisions`, and `Deferred` during audit phases.

**Size:** `SESSION_STATE.md` is the phase's single document. It grows during audit phases and shrinks during feature development. No fixed line cap. Do not create separate per-audit files — a separate file risks becoming a dangling pointer if not applied in lock-step. When the phase closes, Chat 1 trims resolved items; the changelog in `AGENTS.md` is the archive.

**Migration note:** A new Chat 1 picking up mid-phase reads `SESSION_STATE.md` first, not the Changelog. The Changelog is a section-touched index (date → sections → one-phrase summary → pointer), not a narrative. If the state file doesn't explain a decision, the Chat 1 requests `npm run dump -- <path>` on the affected file or reads the referenced section. Do not rely on the Changelog alone to reconstruct mid-audit context.

### 25.4 Prompt Templates
Canonical starts for each role. The user copies one line from a previous chat's onboarding prompt, or types it manually, and pastes it together with the repomix.

**Start Chat 1 (new phase or full audit):**
```
ROLE: CHAT 1 (Brain). Follow AGENTS.md §25. Read SESSION_STATE.md. You plan, audit, and generate Chat 2 prompts. You do not write production code. Stay in this session across the full audit cycle; only OFFBOARD ends it. Objective: <one line or "resume from SESSION_STATE.md">. DeepThink: ON.
```

**Start Chat 1 (phase-review handoff):**
```
ROLE: CHAT 1 (Brain). Follow AGENTS.md §25. Read SESSION_STATE.md. The previous Chat 2 session completed phase <name>. Review its mega files; approve the phase closed or emit a correction prompt. Do not start the next phase without Chat 0 approval. DeepThink: ON.
```

**Start Chat 2 (execution):**
```
ROLE: CHAT 2 (Hands). Follow AGENTS.md §25. Read SESSION_STATE.md. You produce one mega file per §5.1 for the current batch and update SESSION_STATE.md inside it. Do not ask granular questions; follow §25.5. If you need exact file contents, output a single line: npm run dump -- <paths>. Plan your dump list once — see §25.5.1. Start with NextAction from SESSION_STATE.md. Stay in this session across batches; only OFFBOARD ends it. DeepThink: OFF.
```

**Offboard (ask the current chat to hand off):**
```
OFFBOARD. Produce: (1) a one-line onboarding prompt for the next chat per §25.6, and (2) if SESSION_STATE.md is stale, a mosaic mega file updating it. No other output. End with a `Toggle DeepThink: <ON|OFF>` line for the target session.
```

**Resume (mid-phase, same role):**
```
ROLE: CHAT <1|2>. Follow AGENTS.md §25. Read SESSION_STATE.md and resume from NextAction. No further context needed. DeepThink: <ON|OFF>.
```

**Phase complete (Chat 2 end-of-phase declaration, used once):**
```
PHASE COMPLETE
Phase: <name>
Batches: <N of M>
Files touched: <list>
Tests: <pass|fail, count>
SESSION_STATE.md updated: yes
NextChatRole: <chat1 | chat2>
```

### 25.5 Question Policy and Reasoning Discipline

**Question policy.** Chat 2 must not ask granular questions during execution. It asks **only** when the answer would change one of:
- Product scope (a new feature, a removed feature, a change to user-visible behavior)
- Architecture (data model, sync semantics, auth, or any invariant in §6, §9, §18, §20)
- External contract (Appwrite schema, function signature, column definition)

For anything else — naming, file placement, styling choices, which existing pattern to reuse, whether to add a test — Chat 2 picks the option most consistent with `AGENTS.md` and existing code, states the assumption in the `===COMMIT:...===` line, and proceeds.

If a decision fits within the current batch's scope and follows an existing pattern, it is not a question. It is an implementation detail.

**NOT a question:** file placement, variable/file naming, whether to add a test, which existing pattern to reuse, comment inclusion, import order, style choices already covered by lint.

**IS a question:** adding/removing a schema field, changing a §6/§9/§18/§20 invariant, changing user-visible behavior, changing an Appwrite function contract.

**Chat 1** has no question policy restriction — it is expected to surface open questions and record them in `SESSION_STATE.md`'s `OpenQuestions` field.

**Reasoning discipline (all chats).** Over-thinking wastes tokens without improving the artifact. These rules target the observed patterns — decision loops, spec re-reads, inline option enumeration — without reducing reasoning about the task itself.

- **Read dumps once.** Do not re-read a section to re-verify a fact you already extracted.
- **Do not restate the task or the spec.** Both are in context. Begin at the first non-obvious decision.
- **Decide once.** No prose iteration on a decision already made. "Actually," "wait," and "hmm, but" are signals to commit or drop in one line — not to re-reason.
- **Do not enumerate options you will not choose.** If an existing pattern makes the answer obvious, apply it and move on.
- **Question-policy decisions get decided once** — naming, file placement, styling, which pattern to reuse. Pick, state the choice in the commit line, proceed.
- **Do not pre-verify the installer.** Lint/test/build run after the mega file. Reasoning about their outcome adds nothing.
- **Do not resolve hypotheticals the task did not ask about.** Note the edge case in one line; do not design for it.
- **One plan, one pass.** No mid-implementation redesign unless a dump contradicts the plan.
- **Do not restate reasoning in the artifact.** The mega file contains files, not commentary.
- **A second "final" is a spec-gap signal.** If you write "final design" twice, the first pass was incomplete. Close the gap in one line; do not restart.
- **Your response is the mega file plus §25.8 lines.** No preamble, no post-amble.
- **Do not announce what you are about to do.** Do it.
- **Do not narrate decisions the question policy already resolved.**
- **Mega files contain only files whose content changes.**

**25.5.1 Dump discipline.** Before emitting any mega file that touches ≥2 files, Chat 2 first outputs a single `npm run dump -- <paths>` line listing every file whose current content it needs. One line, one round-trip. If after receiving the dump Chat 2 discovers exactly one more file is needed, a second request is tolerated. A **third** request in one batch is a planning failure: Chat 2 states `planning error — proceeding best-effort` and emits the mega file with whatever context it has, rather than dumping again. For any batch touching ≥3 files, the *plan* step (identifying the dump list) should run with DeepThink ON; the emission step may run with DeepThink OFF.

### 25.6 Offboarding
Offboarding has exactly two triggers, with different targets:
- (a) Phase completion. Chat 2 has just appended the PHASE COMPLETE declaration (§25.4) to its final mega file. Chat 2 emits a handoff prompt targeting Chat 1. Automatic; no user command.
- (b) User-typed OFFBOARD. The current chat emits a handoff prompt targeting NextChatRole from SESSION_STATE.md.

Offboarding is per-phase, not per-batch. Chat 2 does not produce an offboarding prompt mid-phase except on a user-typed OFFBOARD. A mid-phase prompt without one of these two triggers is a spec violation of the same class as Chat 1 emitting a next-session prompt after an audit brief.

When a chat is asked to offboard, it produces exactly two things, in this order, with nothing else:

1. **A one-line onboarding prompt** in the format from §25.4. Target role depends on the trigger: phase completion targets Chat 1, user OFFBOARD targets SESSION_STATE.md's NextChatRole. Objective is "resume from SESSION_STATE.md" unless there is context not yet in the state file, in which case append it after a semicolon. **The prompt MUST end with a `Toggle DeepThink: <ON|OFF>` line** recommending the target session's initial DeepThink setting.

   When the target is Chat 1, the prompt body MUST additionally include: (a) what was done, 2–3 sentences; (b) files touched; (c) review focus; (d) test status. A target-Chat-2 prompt does not need these — SESSION_STATE.md carries the state.

   The summary is the sole review artifact. Chat 1 does not request the mega file, the applied diff, or a git diff. If the summary is insufficient, Chat 1 requests `npm run dump -- <paths>` and reads the affected files directly.

   The prompt is emitted inside a Markdown code fence whose backtick count is strictly greater than the longest backtick run appearing anywhere inside the prompt body. Four backticks is the default; bump to five or more if the prompt body contains a four-backtick run.

   Example:
   ````
   ROLE: CHAT 2 (Hands). Follow AGENTS.md §25. Read SESSION_STATE.md. Resume from NextAction. Start with the current batch. DeepThink: OFF.
   ````

2. **A `SESSION_STATE.md` update**, emitted as a mosaic mega file per §5.1, **only if the state file is stale**. If it is current, the chat says so in one line and stops.

The user then pastes (1) into the next chat and (2), if present, into `pending-changes.txt`. That is the entire handoff.

**The new chat's full input is:**
- One repomix (`repomix --compress` by default)
- The one-line prompt from (1)

No other context is needed. The new chat reads `AGENTS.md §25` and `SESSION_STATE.md` from the repomix and knows what to do.

### 25.7 Rate Limit Mitigation
- Default to Tier 1 (`repomix --compress`, ~54k tokens) for both chats. Never send full repomix unless the task genuinely requires Tier 3.
- Use `npm run dump -- <paths>` for exact file contents instead of re-sending the whole repo.
- Keep `SESSION_STATE.md` short so onboarding a new chat is cheap.
- Start a new chat only when the current one is actually slow, confused, or out of context — not after every batch.
- The `dump` command copies to the system clipboard automatically (macOS `pbcopy`, Windows `clip`, Linux `wl-copy`/`xclip`/`xsel`). If no clipboard tool is available, the content is still printed to stdout.

### 25.8 Post-Batch Instructions (Chat 2 only)
Chat 2 always appends brief next-step instructions immediately after the mega file's closing fence. The instructions are one to four lines, no preamble. They always begin with the apply command and branch on its outcome.

**Every Chat 2 response ends with a line `Toggle DeepThink: <ON|OFF>`** recommending whether the user should turn DeepThink on or off before their next message to Chat 2. Rationale: DeepThink ON during the *plan* step (dump-list identification, architectural decision) improves the plan; DeepThink ON during mechanical emission just burns cycles. See §25.10 for defaults.

Mid-phase batch:
```
Run `npm run apply`.
- Pass → reply "continue" and I'll start <next batch>.
- Fail → paste the error and I'll emit a fix.
Toggle DeepThink: <ON|OFF>
```

Phase-final batch (the mega file contains the PHASE COMPLETE declaration):
```
Run `npm run apply`.
- Pass → offboard to Chat 1 with the prompt below.
- Fail → paste the error.
Toggle DeepThink: OFF

<offboarding prompt, inside a fence with strictly more backticks than any inner run>
```

Chat 2 never emits the offboarding prompt for a mid-phase batch, even if the user reports a successful apply. Only a phase-final batch produces it. This is §25.6's "no mid-phase offboarding prompt" rule made concrete.

### 25.9 Reasoning Discipline (cross-reference)
Merged into §25.5 (second half). Do not duplicate.

### 25.10 DeepThink Toggle Defaults
Every chat response that the user will act on ends with a `Toggle DeepThink: <ON|OFF>` line recommending the setting for the user's *next* message to that chat.

- **Chat 2:** OFF by default. ON when the next message's *plan* step is architectural or spans ≥3 files. For a batch with a known plan (single-file edit, one-line answer, mechanical emission), OFF.
- **Chat 1:** ON for audits and architecture. OFF for prompt generation and doc-only edits.
- **Offboarding prompts:** MUST carry a `Toggle DeepThink:` line for the target session (§25.6).
- **Initial prompts (§25.4):** carry a `DeepThink: <ON|OFF>` field on the first line so the user knows what to set on the new chat.

### 25.11 Phase-Close Protocol (Chat 1)
When Chat 1 closes a phase:
1. Trim SESSION_STATE.md: collapse `Findings`/`Decisions` for closed batches to one line per phase; drop resolved items.
2. Update `LastAuditSummary` with a one-line outcome; set `ActivePlan` to the next phase or `none`.
3. Verify no dangling cross-references: any finding ID or decision referenced from AGENTS.md must either still exist in SESSION_STATE.md or be inlined into the changelog row for that phase. Do not leave IDs that point at trimmed state.
4. Add the final Changelog row with pointer to SESSION_STATE.md for that phase's decisions.
5. If the phase produced any "Accepted Limitations," confirm the rationale paragraphs in §18 are intact and not reduced to a pointer that loops back to the Changelog.

## 26. Writing AGENTS.md — rules for writing rules
- Every rule must prevent an error the LLM actually makes without it. Verify against observed fix cycles.
- One-line imperative first. Rationale elsewhere.
- Historical context never in the rule.
- Changelog rows are indexes, not summaries.
- Cross-reference, don't restate.
- Before adding a rule: has Chat 2 emitted a fix-cycle mega file because of this exact mistake? If no, don't add.
- Format for DeepSeek: numbered rules, short imperative sentences, grouped by action (when writing an effect, when patching a row) not by topic.
- §0 exists and holds the must-not-miss rules.
- Rationale paragraphs live in the section body, not in the rule.

## Changelog

| Date | Title | Sections | Summary | Pointer |
|---|---|---|---|---|
| 2026-09-15 | Auth context single source of truth | §4, §8, §9, §10, §15, §18, §19, §23 | `AuthProvider` owns session; `useAuth` shim; `logout()` returns boolean; global 401 event; multi-tab broadcast; offline retry screen; sync after login | §23 |
| 2026-09-15 | Auth lifecycle closure | §9, §10, §15, §18, §23.4–23.7 | `guardedCall` centralizes 401 dispatch; `isUsernameAvailable` returns null on 401; retry + backoff; changelog added | §23.4 |
| 2026-09-15 | Revision workflow tooling | §5.1 (new), §15 | Mega-file + `apply-changes.mjs` installer with backup/lint/build/rollback | §5.1 |
| 2026-09-15 | Tilde outer fence + local-dirty-wins | §5.1, §18 | Outer fence switched to tildes; length-matched closing; inner backticks inert; local-dirty-wins documented | §5.1, §18 |
| 2026-09-15 | Backlog cleanup | §4, §8, §9, §20.3, §20.5 | Scope annotation; phase reorder; legacy peer cross-ref; read-receipt cadence | §20.5 |
| 2026-09-16 | Backlog closure follow-up | §6, §8, §10, §11, §15, §18, §20.3, §20.7, §21, §23.4, §23.7 | Fence-aware parser; `Parameters<T>` trap; `msg_` guard; `makeUnauthorizedError`; `sdk.ts` guarded surface + ESLint; bounded loops; two-phase read-then-write; reaction timeout toast; ChatPage poll 30s | §5.1, §6, §18 |
| 2026-09-16 | Read-receipt worst-case correction | §20.5 | Corrected to 90–120s (30s poll + 60s backoff cap); keep code, fix doc | §20.5 |
| 2026-09-16 | Calendar rendering pipeline | §16 | Slide windowing; `tasksByDate` Map; memoized day arrays/`DayCell`/`CalendarBody`; friend refetch throttle; ref-counted `useTaskImage`; manual windowing | §16 |
| 2026-09-16 | Fence-rule rewrite | §5.1 | 4-tilde outer vs ≤3 inner; pitfalls subsection | §5.1 |
| 2026-09-16 | Mounted pane freshness | §18 | Refetch on activation with minimum interval; `PersonPane` reference | §18 |
| 2026-09-16 | Calendar perf dead-code removal | §8, §15 | Marked complete; removed `CalendarView`/`ViewContainer`/`DiaryView`/`TodoListView` | §8 |
| 2026-09-16 | Test Suite Layers 1–4 | §5.1, §8, §10, §12, §15, §24 (new) | 152 tests, 3 projects; installer runs `npm test`; `allowEmptyCatch`; §24 layout/philosophy/helpers | §24 |
| 2026-09-16 | Test Suite Layer 5 | §8, §15, §24 | Components project (happy-dom + RTL); totals 211/26/4 projects | §24.2 |
| 2026-09-16 | Conversations / unread audit | §8, §9, §15, §16, §24 | `ConversationsProvider` + `FriendsProvider` own subscriptions; thin selectors; `ConversationRow` memo; `isUnsent` excluded; F11–F13 invariants | §16 |
| 2026-09-16 | Sync engine audit (13 slices) | §6, §8, §10, §12, §15, §18, §20.5, §20.7, §24 | Listener isolation; dirty boundary at cycle-start; state versioning; page cap; user-scoped lastSync; server-owned `read_at` before dirty-skip; `_meta.lwt` re-check; `createRow` 404; Web Locks; `messageActionQueue`; drift detection; D6 `updatedAt`; `SyncStatusSheet`. Accepted limitations D1/D3/D7/F9-backoff | §18 Accepted Limitations, §20.5 |
| 2026-09-16 | Sync Status UI (F16) | §8, §10, §15, §24 | `SyncStatusSheet` surfaces `SyncStatus.errors` via Settings; only user-visible sync-error surface | §10 |
| 2026-09-16 | Chat 1 lifecycle clarity | §25.1, §25.4, §25.6 | One Chat 1 session spans full audit cycle; only user `OFFBOARD` hands off; unprompted next-session prompt is a spec violation | §25.6 |
| 2026-09-16 | Dump XML format | §5.1, §25.2 | `dump-files.mjs` emits repomix `<file path>` XML; distinguishes read vs write formats | §5.1, §25.2 |
| 2026-09-16 | Offboarding trigger split | §25.3, §25.4, §25.6 | Phase completion → Chat 1; user OFFBOARD → NextChatRole; review payload for Chat 1; PHASE COMPLETE replaces per-batch declaration | §25.6 |
| 2026-09-16 | Chat 1 docs carve-out | §25.1, §25.6 | Chat 1 may emit docs-only mega files; review is logical, not byte-level; payload is sole artifact | §25.1 |
| 2026-09-16 | SESSION_STATE.md as phase document | §25.3 | No per-audit files; optional `Findings`/`Decisions`/`Deferred`; phase-scoped growth/trim | §25.3 |
| 2026-09-16 | Offline write resilience outbox | §10, §15 | `socialOutbox.ts` retries reciprocal friendship + profile writes; permanent drops emit failure events; `getCurrentUserId` distinguishes 401 from offline | §10, §15 |
| 2026-09-17 | Post-batch + reasoning discipline + apply clipboard | §25.1, §25.8 (new), §25.9 (new), §15 | §25.8 codifies post-batch lines; §25.9 codifies reasoning discipline; `apply-changes.mjs` copies output to clipboard; `clipboard.mjs` extracted | §25.8, §25.9 |
| 2026-09-17 | AGENTS.md compression | all | §0 hard rules added (10 → 9 on follow-up; grouped by action, dedup 2/10); §26 rules-for-writing-rules added; §8 + Changelog reformatted as index rows; section-level prose compressed throughout; ~25% AGENTS.md reduction | §0, §26 |
| 2026-09-17 | §0 dedup follow-up | §0 | Merged former rules 2 + 10 into one; §0 is now 9 rules grouped by action (schema → sync → messaging → cross-user → auth → tooling) | §0 |
| 2026-09-17 | Compression follow-up | §2, §18, §16, §25.3, §25.11 (new) | Restored D1/D3/D7/F9-backoff rationale paragraphs in §18 (non-circular; no pointer-to-changelog loop). Restored behavioral specs for planned views in §2 (Todo List, Diary, Notifications, calendar layout alignment) so Phase 3.5–3.7 has a spec. Dropped F1/F3/F5/F12/F13 IDs from §16 — rule text alone is sufficient for cold readers; IDs were dangling once SESSION_STATE.md trimmed. Added §25.3 migration note (new Chat 1 reads SESSION_STATE.md first, not Changelog). Added §25.11 Phase-Close Protocol to prevent dangling cross-references recurring | §2, §16, §18, §25.3, §25.11 |
| 2026-09-17 | Phase 1 audits closed; accessibility rules documented | §8, §14, §15, §18, §25.2, §25.4, §25.8, §23.6, §24 | Phase 1 CLOSED. Four accessibility rules added to §14 (icon-variant aria-label; interactive motion.div → motion.button; focus-visible rings on primitives; label association via htmlFor/useId). §18 accepted-limitations gains image-cache no-eviction paragraph. §15 gains imageCache.ts single-owner line and SW-scope line. §25.2 dump requests wrapped in tilde fences. §25.8 requires DeepThink ON/OFF in every Chat 2 prompt. §23.6 adds offline auth gate (H1 = Option A, scheduled Phase 2 batch 2.1). Dangling D8/F12/F13/F17/D4 cross-refs removed. Test count 347 | §25.11, §23.6, §14, §15, §18 |
| 2026-09-18 | Phase 2 refactor audit → refactor closed | §8, §23.6, §25.2, §25.4, §25.5, §25.6, §25.8, §25.10, §5.1, §15 | Phase 2 CLOSED (batches 2.1–2.10). OFF-1 offline auth gate shipped. Duplication sweep (DUP-1…12), component boundary audit (CB-1…14), hook boundary audit (HB-1…12) — all findings closed. §25.5 gains dump discipline subsection 25.5.1 (one-dump rule); §25.9 reasoning discipline folded into §25.5; §25.6 offboarding prompt MUST end with `Toggle DeepThink:` line; §25.10 defines per-response DeepThink recommendation; §25.4 initial prompts carry `DeepThink:` field; §25.8 post-batch block ends with `Toggle DeepThink:` line; §5.1 mega-file shape illustration no longer shows a copy-pasteable opener, adds emission checklist, adds git commit prompt spec; installer `npm run apply` prompts Y/N to commit touched paths on green verify. Test count 390 | §25.11, §5.1, §25.5.1, §25.10 |
