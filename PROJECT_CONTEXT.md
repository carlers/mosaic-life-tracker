# LifeTracker (Working Title: Mosaic/Tessera) - Project Context & Architecture

## 1. The Vision
- An offline-first, local-first, self-hostable "Life Tracker" PWA
- **Phase 1:** A pixel-perfect, highly polished clone of "Todo Mate" (tasks, categories, social calendar, diary) to replace an ad-filled app
- **Phase 2:** Optional, modular integrations for fitness, media, and personal CRM
- **Core UX:** A unified, dark-mode calendar view that aggregates all life data, featuring 0ms load times (via RxDB), bottom-sheet interactions, and 100% offline functionality. Cloud is strictly for background sync

## 2. Product Reference: The "Todo Mate" Clone (Phase 1)
- **Dark Mode Aesthetic:** Clean, dark UI (`bg-[#111111]` / `bg-[#1E1E1E]`) with high-contrast, user-defined colors for categories
- **The Home Page & View Switcher:** Top-left button toggles between three sub-views: Calendar, Todo List, and Diary. The app must remember the user's last selected view (via localStorage or RxDB settings)
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

## 3. Strict Constraints
- **Budget:** $0 for AI tools. $0 for Apple (relying on PWA "Add to Home Screen"). $25 one-time for Google Play (later)
- **Hosting:** Free managed cloud initially (Appwrite Singapore), easily self-hostable on a home NAS via Docker later
- **Performance:** Must load instantly (0ms) and work 100% offline
- **Mobile PWA Testing:** Local IP testing often fails due to Appwrite CORS and mobile OS SSL restrictions for background Service Worker API calls. Always use Cloudflare Tunnels (`cloudflared tunnel --url http://localhost:5173`) for reliable mobile testing, and whitelist the tunnel URL in Appwrite Platforms

## 4. The Locked Tech Stack
- **Frontend:** Vite + React 18 (TS) + React Router v6 + Tailwind CSS v3 + lucide-react + date-fns
- **Media & UI:** `browser-image-compression` (max 150KB base64), `emoji-picker-react`
- **Local DB & Sync Engine:** RxDB v17 (using `getRxStorageDexie` and `wrappedValidateAjvStorage`)
  - **CRITICAL:** We do NOT use the `replicateAppwrite` plugin. We use a custom REST-based sync engine (`src/db/sync.ts`) that directly calls the Appwrite TablesDB API via `fetch`
- **Backend:** Appwrite 2.0 (TablesDB)
- **PWA:** `vite-plugin-pwa` (with `registerType: 'autoUpdate'`)

## 5. The "Brain Generates, Human Executes" Workflow
- **AI Role:** The AI writes 100% of the production-ready code. No local AI agents are used for coding
- **Human Role:** The user manually creates files, pastes the AI's code, and runs terminal commands
- **Code Generation Rules:** The AI must output complete, copy-pasteable files (no `// ... rest of code` placeholders). Files should be organized by logical separation, not arbitrary line limits

## 6. Appwrite 2.0 Strict Guardrails (CRITICAL)
- **Regional Endpoint:** Must use the specific regional endpoint found in the project URL (e.g., `https://sgp.cloud.appwrite.io/v1`), NOT the generic `cloud.appwrite.io`
- **Use TablesDB, NOT Databases:** All SDK calls must use the TablesDB service (e.g., `tablesDB.createRow`), not the deprecated Databases service
- **Permission String Format:** Use the new format: `create("any")`, `read("any")`, `update("any")`, `delete("any")`. The old `"role:any"` formats are deprecated
- **Row-Level vs Table-Level Permissions (VERIFIED):** `Permission.create()` **does NOT apply to rows**. Applying it to a row throws an error. Row-level permissions must only ever be `[read, update, delete]`. The **`create` permission belongs on the TABLE-level permissions** in the Appwrite Console (e.g., grant `create("users")` at the table level so authenticated users can insert new rows). If new-row sync fails with 401/403, the fix is in the Console, NOT in `buildRowPermissions`
- **REST Endpoints:** Base path for tables is `/v1/tablesdb/{databaseId}/tables/{tableId}`
- **ID Mapping:** RxDB primary key `id` maps directly to Appwrite's `$id` column
- **Session Management:** Appwrite sometimes auto-creates a session on signup. Always wrap `account.createEmailPasswordSession` in a `try/catch` during signup, and explicitly clear stale sessions (`account.deleteSession('current')`) before login to prevent "Session is already active" errors
- **`$sequence` Type Change:** In Appwrite 2.0, `$sequence` is now a `string` (was `int`). Currently unused in this codebase, but note it if you ever sort by sequence

## 7. UI/UX & Architectural Guardrails
- **Dynamic Colors:** Category colors MUST be applied via inline styles (`style={{ backgroundColor: cat.color }}`). NEVER use dynamic strings in Tailwind classes
- **Predefined Colors Only:** Use a strict array of hex codes (`src/constants/colors.ts`) for the `ColorPalettePicker`. NO free-form hex inputs
- **Bottom Sheet Standardization:**
  - All modals MUST use the `<BottomSheet>` primitive
  - **CRITICAL:** `<BottomSheet>` MUST use `ReactDOM.createPortal` to render directly into `document.body` to escape parent z-index and overflow traps, guaranteeing it sits above the `BottomNav`
  - **Drag Restriction:** Drag-to-close must be restricted to the header handle using Framer Motion's `useDragControls` and `dragListener={false}` on the main container. This prevents accidental closes while scrolling content
- **Sticky Layout Rules:** For `position: sticky` to work correctly inside the app, `MainLayout` root must be `h-screen overflow-hidden`, and the `<main>` tag must be `flex-1 overflow-y-auto`
- **RxDB Reserved Keywords:** NEVER use `deleted` as a field name in RxDB schemas (it is a reserved keyword). Always use `isDeleted` locally and map it to `deleted` in the Appwrite sync layer
- **Soft Deletes:** Never hard delete. Always use `isDeleted: true` for RxDB tombstones
- **Strict ISO Dates:** All date fields MUST be stored as ISO 8601 strings (`yyyy-MM-dd` for day keys, full `.toISOString()` for timestamps)
- **iOS Storage:** Must call `navigator.storage.persist()` on app launch to prevent WebKit from purging IndexedDB
- **Coming Soon:** Bottom nav has 5 tabs: Home, Explore, Notifications, Messages, Account. Tabs 2-4 render a full `<ComingSoon />` page

## 8. Current Progress & State (As of Latest Build)
- ✅ **Phase 1.1 - 1.3 Complete:** App Layout, Primitives (Button, Input, Avatar, OfflineBanner), BottomSheet (with Portal & Drag Controls), Auth Flow (with session clearing), PWA Config, and React Router wiring
- ✅ **Phase 2.1 - 2.2 Complete:** Home Page Shell, View Memory (localStorage), Calendar View (Month/Week) with refined grid styling, natural text cutoff, perfect vertical alignment, and smart view-switching logic
- ✅ **Phase 2.6 Complete:** Category Manager Sheet, Color Palette Picker (with Default/Vibrant/Pastel tabs), and `useCategories` hook wired to RxDB
- ✅ **Phase 2.3 Complete:** Day View Bottom Sheet with inline task creation, real `useTasks` data wiring, task action sheet, memo sheet, date picker, image picker/viewer, and delete confirmations
- ✅ **Conventions Hardening Complete:** `window.confirm` eliminated (nested sheet pattern enforced), iOS focus behavior fixed (ref-based), Appwrite row-permission correctness verified
- 🔄 **Next Up:** Phase 3 (Todo List View — compact color grid + vertical task list for selected day)

---

## 9. Hook & State Conventions
- **Hook Return Shape:** Every custom hook MUST return a **named object**, never an array. Standard fields: `{ data, isLoading, ...mutators }`. Mutators are always `useCallback`-wrapped
- **User-Scoped Data Guard:** Any hook that reads user data (`useTasks`, `useCategories`, `useDiary`, `useSettings`) MUST track a separate `loadedUserId` state alongside the data. Expose data only when `loadedUserId === userId`; otherwise return `[]` and set `isLoading = true`. This prevents cross-user data leakage during logout/login transitions
- **Dependency Arrays:** Hooks MUST depend on `user?.$id` (primitive string), NEVER the `user` object itself. Prevents re-subscription storms from Appwrite object identity churn
- **Observable Subscriptions:** All RxDB reads use `query.$.subscribe(...)` inside a `useEffect`, storing the subscription and unsubscribing in cleanup. Always pair with an `isMounted` boolean guard before calling `setState`
- **Mutator Signatures:**
  - Add: `Omit<Doc, 'id' | 'userId' | 'createdAt' | 'updatedAt' | 'isDeleted'>`
  - Update: `(id: string, updates: Partial<Doc>)`
  - Both always `useCallback` with `user?.$id` in deps
- **"Sync State From Props" Pattern (React 18/19):** When a component receives a doc via props but needs local editable state, use the *render-body reset* pattern:
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

## 10. Error Handling & Logging Conventions
- **Hook/Service Log Prefix:** All `console.error` and `console.warn` calls MUST be prefixed with `[ComponentName]` or `[hookName]` in square brackets (e.g., `[useTasks]`, `[Storage]`, `[Sync]`, `[Bootstrap]`, `[RxDB]`). Makes log filtering trivial
- **Guard Clause Errors:** When a mutator is called without an authenticated user, log `[hookName] Cannot <action>: User not authenticated` and return silently. Never throw — the UI shouldn't crash because of a race with logout
- **Silent Session Cleanup:** Before any `account.createEmailPasswordSession`, wrap a `try { await account.deleteSession('current') } catch {}` — swallowing that error is intentional and required
- **DEBUG Gating:** Non-error diagnostic logs MUST be wrapped in `if (import.meta.env.DEV)` or gated behind a module-level `const DEBUG = import.meta.env.DEV`. Never log to production consoles
- **Error Surfacing to UI:** Use a fixed-position toast (`fixed bottom-24 left-1/2 -translate-x-1/2 z-[70]`) with auto-dismiss via `setTimeout` (2000ms) — see DayViewSheet's `deleteFeedback` pattern. Do not use `alert()` for anything except placeholder "Coming Soon" features

## 11. ID Generation & Naming
- **Client-Generated IDs:** All primary keys are generated client-side (no server round-trip) with a type prefix:
  - Tasks: `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Categories: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  - Images: `img_${crypto.randomUUID().replace(/-/g, '')}` (with a `getRandomValues` fallback for iOS)
  - Deterministic composite IDs (settings, diary): `${userId}_${key}` or `${userId}_${date}`
- `Math.random().toString(36).substr(2, 9)` is the standard suffix — do not use `.slice()` in new code (consistency with existing)

## 12. Field Naming & Serialization
- **Local ↔ Remote Mapping Rules:**
  - RxDB is camelCase; Appwrite TablesDB columns are snake_case
  - All mapping is centralized in `src/db/sync.ts` (`toAppwriteFormat` / `fromAppwriteFormat`). Never map ad-hoc in hooks or components
  - `isDeleted` (local) ↔ `deleted` (remote) — this is a hard rule because `deleted` is a reserved RxDB keyword
  - Booleans encoded as booleans, not 0/1
- **Date Storage:**
  - Day keys (task date, diary date, sorting): `yyyy-MM-dd` via `date-fns.format`
  - Timestamps (`createdAt`, `updatedAt`, `completedAt`): full ISO 8601 via `.toISOString()`
  - When comparing timestamps, always use the `toMs()` helper pattern (`Number.isFinite` guard)
- **Empty-String Over Null:** Optional string fields (`memo`, `image`, `completedAt`, `icon`) MUST default to `''`, never `null` or `undefined`, so RxDB schema validation never fails

## 13. Modal & Bottom Sheet Structure
- **One Sheet = One File:** Every sheet lives in its own file and takes `{ isOpen, onClose, <entity>, onSave/onConfirm }` props. No context-based sheet orchestration
- **Nested Sheet Choreography:** When one sheet opens another (TaskActionSheet → MemoSheet), the parent passes `isLocked={isBackgroundLocked}` down. `isBackgroundLocked` is computed from a single boolean OR of all child-sheet open states
- **Action Sheets Close Themselves Before Opening a Sibling:** When an action button in TaskActionSheet needs to open MemoSheet, ImageViewer, etc., the pattern is: `onClick={() => { onX(); onClose(); }}` — the action sheet must visually dismiss before the sibling opens
- **Sheet Content Padding:** Sheet bodies use `pt-2 pb-8 px-4` (or `px-1` for full-width lists). Do not add extra wrappers
- **Delete Confirmations:** Destructive flows inside a sheet MUST open a nested BottomSheet with `isLocked={true}` and a two-button `[Cancel | Delete]` row (`bg-[#2A2A2A]` / `bg-red-500`). `window.confirm` is BANNED in sheets. The reference implementation is DayViewSheet's "Delete Photo" sheet; CategoryManagerSheet's "Delete Category" sheet mirrors it
- **Deleting State:** Nested delete-confirm sheets track a local `isDeleting` boolean and render a spinner inside the Delete button while the async operation is in flight

## 14. Component Conventions
- **Export Style:** Components are named exports (`export const Foo: React.FC<Props> = ...`). No default exports except `App.tsx`
- **Props Interface Above Component:** Always declare `interface XxxProps { ... }` immediately above the component; never inline
- **Memo + displayName:** Any component wrapped in `React.memo` MUST set `.displayName` to the component name
- **Prop Callbacks:** Internal handlers are `handleX` (useCallback for anything passed to children or used in useEffect deps). External props are `onX`
- **Stop Event Leakage in Lists:** Buttons/inputs inside tappable rows MUST call `onPointerDown={(e) => e.stopPropagation()}` to prevent parent row's tap handler from firing (critical inside Swiper slides)
- **Animation Tokens:** Entry animations use `animate-in fade-in duration-300` or `animate-in fade-in slide-in-from-<dir>-1 duration-200`. Framer Motion `whileTap={{ scale: 0.95–0.98 }}` on all tappables
- **Spinner Primitive:** Loading spinners are ALWAYS `<div className="w-N h-N border-2 border-white border-t-transparent rounded-full animate-spin" />`. No SVG spinners, no library spinners

## 15. File Organization Rules
- `src/components/ui/` — pure, entity-agnostic primitives (Button, Input, BottomSheet, Avatar, ColorPalettePicker, OfflineBanner)
- `src/components/layout/` — chrome that wraps routes (MainLayout, BottomNav, AppLayout, ComingSoon)
- `src/components/home/views/` — feature components scoped to the Home page; sub-sheets for a view live alongside the view (DayViewSheet next to CalendarView)
- `src/hooks/` — one hook per data domain (useTasks, useCategories, useDiary, useSettings) plus focused utilities (useTaskImage, useImageCompression)
- `src/lib/` — side-effectful SDK wrappers and pure utilities (appwrite, storage, imageCache, mockData). No React imports allowed here

## 16. List Rendering & Sorting
- **Default Sort Contracts (in hooks, not components):**
  - Tasks: `[{ date: 'asc' }, { createdAt: 'desc' }]`
  - Categories: `[{ order: 'asc' }]`
  - Diary: `[{ date: 'desc' }]`
- **Grouping is Memoized:** Any grouping (e.g., tasks-by-category, tasks-by-date) MUST use a `useMemo` that returns a Map or Record, not a `filter()` inside a `.map()`
- **Empty Arrays Are Module Constants:** Pass shared empty arrays as `const EMPTY_TASKS: TaskDocument[] = []` to keep `React.memo` prop equality stable across renders

## 17. Native Input Quirks
- **Dark Theme `<input type="date">`:** MUST include `[color-scheme:dark]` Tailwind arbitrary class, otherwise the native picker renders light-theme
- **Focus Management:** When opening a sheet or inline "Add" input, focus via a `useRef` + `useEffect` on `[isOpen, taskId]`. NEVER use `autoFocus` — Safari/iOS ignores it inside conditionally-rendered subtrees (any AnimatePresence-wrapped BottomSheet). This applies to both memo editors and title editors, not just inline add inputs
- **File Input Reset:** After an `<input type="file">` upload completes (success OR failure), reset `fileInputRef.current.value = ''` so the same file can be re-selected
- **Body Scroll Lock:** BottomSheet is the only component allowed to touch `document.body.style.overflow`. It uses a module-level `openSheetCount` counter to handle nested sheets correctly

## 18. Async & Race Safety
- **Cancellation Ref:** Every async `useEffect` MUST have a local `let isMounted = true` (or `effectIsActive`) flag, and every `.then`/`await` continuation MUST check it before `setState`. Cleanup sets the flag to `false`
- **Programmatic-Move Guards:** When a component programmatically drives a carousel (Swiper, Embla), set an `isProgrammaticMoveRef.current = true` before calling `.slideTo()` / `.scrollTo()`, and clear it in a `requestAnimationFrame`. Event handlers (`onSlideChangeTransitionEnd`, `onSelect`) check this ref to ignore self-induced events — prevents infinite feedback loops between state and carousel
- **Re-entrancy Guards:** Sync/network loops use a module-level boolean (`isSyncInProgress`) and log-and-return on re-entry rather than queueing

## 19. Bootstrap & Persistence
- **Order of Operations in `main.tsx`:** 1) `navigator.storage.persist()`, 2) `initializeDatabase()`, 3) fire-and-forget `initializeSync()` (never block render on network), 4) `ReactDOM.createRoot(...).render(...)`
- **Non-Blocking Sync:** `initializeSync()` is always called with `.catch()` — a sync failure must never prevent the app from mounting
- **`ignoreDuplicate: true`** on `createRxDatabase` and a singleton `dbInstance` module variable are required to survive React StrictMode double-invocations
```