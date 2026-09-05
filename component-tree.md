# Mosaic/Tessera - Component Hierarchy Map (Living Document)

## 1. Primitives & Shared UI (The Foundation)
- `BottomSheet.tsx`
  - **CRITICAL:** Uses `ReactDOM.createPortal` to render directly into `document.body` to escape parent z-index and overflow traps.
  - **CRITICAL:** Uses Framer Motion `useDragControls` and `dragListener={false}` on the main container. Drag-to-close is strictly restricted to the header handle to prevent accidental closes while scrolling content.
- `Button.tsx` (Variants: primary, ghost, icon, danger. Includes `whileTap={{ scale: 0.95 }}` animation)
- `Input.tsx` (Text input and Textarea with focus border transitions)
- `Avatar.tsx` (Image with fallback to bold initials)
- `OfflineBanner.tsx` (Global sticky banner. Session-based dismissal: resets when network returns)

## 2. Layout & Navigation
- `App.tsx` (React Router v6 setup, Auth route protection, redirects unauthenticated users to `/login`)
- `MainLayout.tsx`
  - **CRITICAL Layout Rule:** Root is `h-screen w-full overflow-hidden`. The `<main>` tag is `flex-1 overflow-y-auto pb-24`. This strict context is required for `position: sticky` to work correctly inside child components.
- `BottomNav.tsx` (5 tabs: Home, Explore, Notifications, Messages, Account. Uses Framer Motion `layoutId` for smooth sliding active indicator)
- `ComingSoon.tsx` (Full-page placeholder for tabs 2-4)

## 3. Home Page (The Core Experience)
*Note: Designed to be reusable for both the current user and friends (via `targetUserId` prop in the future).*
- `HomePage.tsx` (Main container. Manages `activeView` state with localStorage persistence for View Memory)
  - `TopBar.tsx` (Sticky header `sticky top-0 z-20 bg-[#111111]`)
    - `ViewSwitcher.tsx` (Top-left: Toggles Calendar / Todo / Diary. Sliding background animation)
    - `HamburgerMenu.tsx` (Top-right: Opens menu sheet. "Lists & Categories" opens `CategoryManagerSheet`)
  - `ViewContainer.tsx` (Renders the active sub-view based on `activeView` state)
    - `CalendarView.tsx`
      - `ViewToggle.tsx` (Single button toggling between "M" and "W")
      - `MonthView.tsx` (Grid layout. Perfectly vertically aligned with WeekView)
      - `WeekView.tsx` (7-column layout. Header shows "Aug 30 - Sep 5, 2026")
      - `DayCell.tsx`
        - **UI Rules:** No visible grid cell blobs (transparent bg, subtle `hover:bg-[#1E1E1E]`)
        - Day number centered. Saturdays = `text-blue-500`, Sundays = `text-red-500`. Today = blue circle border
        - Tasks fill horizontal space with minimal margins
      - `TaskBlock.tsx` (Used inside `DayCell`. `rounded-[3px]`, `overflow-hidden whitespace-nowrap` for natural text cutoff, NO ellipsis)
    - `TodoListView.tsx` (Placeholder for Phase 2.4)
    - `DiaryView.tsx` (Placeholder for Phase 2.5)
  - `DayViewSheet.tsx` (Triggered ONLY by clicking a day in Calendar/Week view)
    - Wraps content in `<BottomSheet>`
    - Fetches real data via `useTasks` and `useCategories`
    - `CategorySection.tsx` (Groups tasks by category. Includes inline "Add Task" input at the bottom of the section)
    - `TaskItem.tsx` (Custom circular checkbox, title, memo/image indicators. Toggles completion via `useTasks`)

## 4. Account & Settings (Phase 3)
- `AccountPage.tsx`
- `SettingsPage.tsx`

## 5. Modals & Overlays (All use `<BottomSheet>`)
- `CategoryManagerSheet.tsx`
  - Lists categories via `useCategories`
  - Add/Edit modes with rename input and Visibility toggle (private, followers, public)
  - Soft deletes categories (`isDeleted: true`)
- `ColorPalettePicker.tsx`
  - **Structure:** Tabs for palettes ("Default", "Vibrant", "Pastel"). Grid of `w-10 h-10 rounded-full` buttons
  - **Data Source:** Consumes `PREDEFINED_COLORS` array from `src/constants/colors.ts`
  - **CRITICAL:** NO free-form hex inputs. Selection applies via inline style: `style={{ backgroundColor: color }}`
- `TaskActionSheet.tsx` (Phase 2.7)
- `DatePickerSheet.tsx` (Phase 2.7)
- `ImagePickerSheet.tsx` (Phase 2.7)

## 6. Custom Hooks (The Architect's Domain)
- `useAuth.ts` (Login, signup, session. **CRITICAL:** Clears stale sessions before login and catches "session already active" errors on signup)
- `useCategories.ts` (RxDB CRUD, ordering, color management, visibility, soft deletes)
- `useTasks.ts` (RxDB CRUD, filtering by date/category, completion toggling)
- `useSyncStatus.ts` (Pending)

---

## Strict Architectural Rules (Non-Negotiable)

1. **No Tailwind for Dynamic Colors:** Category colors MUST be applied via inline styles (`style={{ backgroundColor: cat.color }}`). NEVER use dynamic strings in Tailwind classes.
2. **Predefined Colors Only:** The AI must use the `ColorPalettePicker.tsx` component and predefined hex arrays. No free-form color pickers.
3. **Bottom Sheet Standardization:** All modals MUST use the `<BottomSheet>` primitive, which MUST use `ReactDOM.createPortal` and restricted drag controls.
4. **Appwrite 2.0 Guardrails:**
   - Use `TablesDB`, NOT `Databases`
   - Permissions: `create("any")`, `read("any")`, etc.
   - Regional Endpoint: `https://sgp.cloud.appwrite.io/v1`
5. **RxDB Reserved Keywords:** NEVER use `deleted` as a field name in RxDB schemas. Always use `isDeleted` locally and map it to `deleted` in the Appwrite sync layer.
6. **Soft Deletes:** Never hard delete. Always use `isDeleted: true` for RxDB tombstones.
7. **Strict ISO Dates:** All date fields MUST be stored as ISO 8601 strings (`yyyy-MM-dd`).
8. **Mobile Testing:** Local IP testing fails due to Appwrite CORS and mobile OS SSL restrictions for background Service Worker API calls. Always use Cloudflare Tunnels (`cloudflared tunnel --url http://localhost:5173`) for reliable mobile PWA testing, and whitelist the tunnel URL in Appwrite Platforms.
9. **View Memory:** The selected sub-view (Calendar/Todo/Diary) must be saved and restored (currently via localStorage).