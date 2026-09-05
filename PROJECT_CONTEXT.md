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
- **REST Endpoints:** Base path for tables is `/v1/tablesdb/{databaseId}/tables/{tableId}`
- **ID Mapping:** RxDB primary key `id` maps directly to Appwrite's `$id` column
- **Session Management:** Appwrite sometimes auto-creates a session on signup. Always wrap `account.createEmailPasswordSession` in a `try/catch` during signup, and explicitly clear stale sessions (`account.deleteSession('current')`) before login to prevent "Session is already active" errors

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
- **Strict ISO Dates:** All date fields MUST be stored as ISO 8601 strings (`yyyy-MM-dd`)
- **iOS Storage:** Must call `navigator.storage.persist()` on app launch to prevent WebKit from purging IndexedDB
- **Coming Soon:** Bottom nav has 5 tabs: Home, Explore, Notifications, Messages, Account. Tabs 2-4 render a full `<ComingSoon />` page

## 8. Current Progress & State (As of Latest Build)
- ✅ **Phase 1.1 - 1.3 Complete:** App Layout, Primitives (Button, Input, Avatar, OfflineBanner), BottomSheet (with Portal & Drag Controls), Auth Flow (with session clearing), PWA Config, and React Router wiring
- ✅ **Phase 2.1 - 2.2 Complete:** Home Page Shell, View Memory (localStorage), Calendar View (Month/Week) with refined grid styling, natural text cutoff, perfect vertical alignment, and smart view-switching logic
- ✅ **Phase 2.6 Complete:** Category Manager Sheet, Color Palette Picker (with Default/Vibrant/Pastel tabs), and `useCategories` hook wired to RxDB
- 🔄 **In Progress:** Phase 2.3 (Day View Bottom Sheet with inline task creation and real `useTasks` data wiring)