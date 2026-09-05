# PLAN.md: Phase 1 Master Checklist

## Phase 0: Infrastructure & POC
- [x] **0.1 Appwrite Setup:** Create Project, Database (`life_tracker`), Tables (`tasks`, `categories`, `diary`, `settings`). Permissions set to `create("any")`, etc.
[x] 0.2 Vite Initialization: Run `npm create vite@latest`. Install Tailwind, React Router, `vite-plugin-pwa`, `lucide-react`, `date-fns`, `browser-image-compression`, `emoji-picker-react`, `rxdb`, `appwrite`, `rxjs`. Configure Tailwind (dark mode), Vite PWA, and `navigator.storage.persist()` in `main.tsx`.
[x] 0.3 The "Brain" Setup: Generate `src/db/schema.ts`, `src/db/database.ts`, `src/db/sync.ts`. (Note: Custom REST sync engine used instead of deprecated plugin).
[x] 0.4 Day 1 Sync POC: Verified database initialization, schema validation, and successful bidirectional sync with Appwrite TablesDB (Singapore endpoint).

## Phase 1: Core UI Shell & Auth
- [x] **1.1 App Layout & Primitives:** Create `MainLayout.tsx` with 5-tab Bottom Navigation. Build `ComingSoon.tsx` page. Build `<BottomSheet>` primitive. Build `OfflineBanner.tsx`.
- [x] **1.2 Auth Flow:** Generate `src/hooks/useAuth.ts`. Build simple Login/Signup screen. Redirect to `/home` when authenticated.
- [x] **1.3 PWA Config:** Finalize `vite-plugin-pwa` manifest and icons.

## Phase 2: Task Management & Core Views
- [x] **2.1 Home Page Shell:** Build `HomePage.tsx` with the Top-Left View Switcher (Calendar/Todo/Diary) and Top-Right Hamburger Menu. Implement view memory (localStorage).
- [x] **2.2 Calendar View:** Build `MonthView` and `WeekView` using `date-fns`. Implement swipe navigation. Map tasks to `DayCell`.
- [x] **2.3 Day View Bottom Sheet:** Build `DayViewSheet.tsx`. Group tasks by category. Implement inline "Add Task" input.
- [ ] **2.4 Todo List View:** Build `CompactCalendar` and `DayTaskList`.
- [ ] **2.5 Diary View:** Build simple `DiaryEditor` (textarea) linked to specific dates.
- [x] **2.6 Category Manager:** Build `CategoryManagerSheet.tsx` and `ColorPalettePicker.tsx` (predefined colors).
- [ ] **2.7 Task Actions:** Build `TaskActionSheet.tsx`. Implement image compression flow, memo editing, and `DatePickerSheet.tsx`.

## Phase 3: Account, Settings & Polish
- [ ] **3.1 Account Page:** Build `AccountPage.tsx` and `SettingsPage.tsx`.
- [ ] **3.2 Settings Implementation:** Implement Theme toggle, Logout, and About/Version info.
- [ ] **3.3 Sync on Focus:** Add event listener to trigger RxDB replication when window regains focus.
- [ ] **3.4 Final Polish:** Ensure all bottom sheets have correct swipe-to-close gestures. Verify all "Coming Soon" toasts and pages.

## Phase 4: Deferred Features (Phase 2)
- [ ] **4.1 Messaging Tab:** Build full chat interface, group chats, and task referencing.
- [ ] **4.2 Advanced Social:** Build "Add Friend" UI, "Selected Followers" visibility logic, and Sticker Shop.
- [ ] **4.3 Routines & Reminders:** Implement recurring task logic and push notifications.
- [ ] **4.4 Analytics:** Build "My Progress" charts and data visualization.