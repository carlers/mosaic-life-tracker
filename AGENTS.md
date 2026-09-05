# AGENTS.md: Strict Rules for Cline (Local 7B AI)

## 1. The Read-Only Database Rule (CRITICAL)
- **NEVER** edit, create, or delete files inside `src/db/`.
- **NEVER** import `rxdb`, `rxjs`, or `appwrite` directly into UI components.
- **ONLY** consume data and trigger actions via the custom React hooks provided in `src/hooks/` (e.g., `const { tasks, addTask } = useTasks()`).
- **NO RxJS:** The UI must never see an Observable. Only consume standard React state arrays and `async/await` trigger functions.

## 2. The Blueprint Mandate (CRITICAL)
- **NEVER** guess UI layouts, flexbox structures, or Tailwind classes. 
- **ONLY** write code based strictly on the provided `docs/blueprints/` file for the current task.
- **PRIMITIVES:** You MUST use the `<BottomSheet>` primitive for all modals and slide-ups. Never write `fixed bottom-0` from scratch.
- If a blueprint is not provided, STOP and ask the user for one.

## 3. Context & VRAM Management (8GB GPU Limit)
- **DO NOT** read the entire workspace. Only read the specific files you are modifying, plus a maximum of 2 reference files.
- Keep all source files under 150 lines of code. If a file gets larger, split it into smaller components.
- When asked to write code, output only the necessary changes. Do not rewrite entire files unless requested.

## 4. Coding Standards & UI Rules
- **Dark Mode & Mobile-First:** Use Tailwind CSS for all styling. Base backgrounds must be `bg-gray-900` or `bg-black`. All layouts must be mobile-first.
- **Dynamic Colors:** Category colors MUST be applied via inline styles (`style={{ color: cat.hex }}`). Never use dynamic strings in Tailwind classes.
- **State & Error Handling:** You must ALWAYS handle `isLoading` and `error` states provided by the hooks. Show spinners for loading, and toasts/alerts for errors.
- **Soft Deletes Only:** If asked to write a delete function, it must update the `deleted` boolean to `true`, never remove the document.
- **Vite SPA:** This is a pure client-side Vite app. Do not add `"use client"` directives or attempt server-side rendering.

## 5. Phase 1 Scope & "Coming Soon" Rules
- **Bottom Nav:** Build 5 tabs: Home, Explore, Notifications, Messages, Account. Tabs 2-4 must render a full `<ComingSoon />` page.
- **Hamburger Menu:** Build the dropdown. "Lists" opens the Category Manager. "Routines" and "Reminders" must trigger a toast notification saying "Coming Soon".
- **Visibility:** For Categories and Diary, the visibility options are `public`, `followers`, and `private`. Do not build UI for "Selected Followers" in Phase 1.

## 6. The Verification Protocol (Definition of Done)
You are not finished until you provide a manual verification step. At the end of every single task, output a block like this:
> **✅ Verification Protocol:** 
> 1. [Step 1 to prove it works, e.g., "Open the app, click Add, type 'Test'"]
> 2. [Step 2 to prove sync/offline, e.g., "Turn off Wi-Fi, refresh, ensure it's still there"]

## 7. Next Steps Protocol
When you finish a task and verify it, ask the user: *"Task complete. Shall I check off this box in PLAN.md and move to the next one?"*
