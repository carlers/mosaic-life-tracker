# Repository source map

A **navigation hint** from user language to likely source entry points, not a React hierarchy or a complete change-impact analysis. Inspect exact-ref code, callers, tests, and the active issue before editing. If the file is already known, open it directly. If resuming an issue, read its checkpoint first.

The [generated component/page inventory](COMPONENT_INDEX.md) lists every eligible source module, including helpers; this curated map covers frequent intents. Governing rules remain in the [documentation index](README.md).

## User intent → initial source candidates

| User phrase / alias | Initial source to inspect (not exclusive owners) | Nearby domain / governing guide |
|---|---|---|
| Home search icon, search bar | [HomePage](../src/pages/HomePage.tsx), [HomeTaskSearch](../src/components/home/HomeTaskSearch.tsx) | [Theme](THEMING.md) |
| Hamburger, Home menu, borderless icons | [HamburgerMenu](../src/components/home/HamburgerMenu.tsx), [HomePage](../src/pages/HomePage.tsx) | [Theme](THEMING.md) |
| Person carousel, friend switcher | [PersonCarousel](../src/components/home/PersonCarousel.tsx), [PersonPane](../src/components/home/PersonPane.tsx) | [Project reference](PROJECT_REFERENCE.md) |
| Calendar view, month/week grid | [MonthView](../src/components/home/views/MonthView.tsx), [CalendarBody](../src/components/home/views/CalendarBody.tsx) | [Project reference](PROJECT_REFERENCE.md) |
| Daycell, click day, tap to open DayViewSheet | [DayCell](../src/components/home/views/DayCell.tsx), [DayViewSheet](../src/components/home/views/DayViewSheet.tsx), [HomePage](../src/pages/HomePage.tsx) | Calendar state and sheet mount; [Test workflow](TEST_WORKFLOW.md) |
| Cold-mount Day View lag, first open delay | [HomePage](../src/pages/HomePage.tsx), [DayViewSheet](../src/components/home/views/DayViewSheet.tsx), [useCalendarState](../src/components/home/views/useCalendarState.ts) | Also inspect lazy imports/data hooks and timing; not just DayCell |
| Day View swipe, dates, day carousel | [DaySlide](../src/components/home/views/DaySlide.tsx), [useDayViewSwiper](../src/components/home/views/useDayViewSwiper.ts) | [Gesture tests](TEST_WORKFLOW.md) |
| Checkbox while typing, task input focus | [TaskItem](../src/components/home/views/TaskItem.tsx), [DayViewSheet](../src/components/home/views/DayViewSheet.tsx) | [Task date interaction](TASK_DATE_INTERACTION.md) |
| TaskBlock ..., cut-off title, ellipsis | [TaskBlock](../src/components/home/views/TaskBlock.tsx), [TaskItem](../src/components/home/views/TaskItem.tsx) | [Theme](THEMING.md) |
| Drag to reorder, move task, category | [DraggableTaskItem](../src/components/home/views/DraggableTaskItem.tsx), [taskReorder](../src/components/home/views/taskReorder.ts), [TaskReorderRuntime](../src/components/home/views/TaskReorderRuntime.tsx) | [Reorder acceptance](MANUAL_TASK_REORDER_ACCEPTANCE.md) |
| Change date, automatic date picker | [TaskDateEditor](../src/components/home/views/TaskDateEditor.tsx), [TaskDateCalendar](../src/components/home/views/TaskDateCalendar.tsx) | [Task date interaction](TASK_DATE_INTERACTION.md) |
| Task action sheet, batch selection | [TaskActionSheet](../src/components/home/views/TaskActionSheet.tsx), [BulkTaskActionSheet](../src/components/home/views/BulkTaskActionSheet.tsx) | [Test workflow](TEST_WORKFLOW.md) |
| Backlogs page, undated tasks | [BacklogPage](../src/pages/BacklogPage.tsx), [DayViewSheet](../src/components/home/views/DayViewSheet.tsx) | Also task placement in src/lib/ |
| Bucket List, dreams, long-term goals | [BucketListPage](../src/pages/BucketListPage.tsx), [BucketListDetailPage](../src/pages/BucketListDetailPage.tsx) | [Bucket links](BUCKET_LIST_LINKS.md) |
| Link a task to a goal | [LinkTaskToBucketSheet](../src/components/home/views/LinkTaskToBucketSheet.tsx), [useBucketTaskLinks](../src/hooks/useBucketTaskLinks.ts) | [Bucket links](BUCKET_LIST_LINKS.md) |
| Bucket-linked task photos, image viewer | [BucketListDetailPage](../src/pages/BucketListDetailPage.tsx), [LinkedTaskPhoto](../src/pages/LinkedTaskPhoto.tsx), [ImageViewer](../src/components/home/views/ImageViewer.tsx) | Also src/hooks/useTaskImage.ts |
| Task image upload, retry, unavailable photo | [ImagePickerSheet](../src/components/home/views/ImagePickerSheet.tsx), [useTaskImage](../src/hooks/useTaskImage.ts), [storage](../src/lib/storage.ts) | Sync/storage cross-cutting; [Sync matrix](SYNC_SCENARIO_MATRIX.md) |
| Phone↔laptop photo sync, missing download | [storage](../src/lib/storage.ts), [sdk](../src/lib/sdk.ts), [pendingImages](../src/lib/pendingImages.ts) | Verify auth and sync; [Sync matrix](SYNC_SCENARIO_MATRIX.md) |
| Shared task invite, recipient task UI | [SharedTaskInvitationInbox](../src/components/explore/SharedTaskInvitationInbox.tsx), [SharedTaskRows](../src/components/home/views/SharedTaskRows.tsx), [useSharedTasks](../src/hooks/useSharedTasks.ts) | [Shared tasks](SHARED_TASKS.md) |
| Shared task dragging, category/date conflict | [SharedTaskRows](../src/components/home/views/SharedTaskRows.tsx), [sharedTaskPlacement](../src/lib/sharedTaskPlacement.ts), [DayViewSheet](../src/components/home/views/DayViewSheet.tsx) | Cross-user coordination; [Shared tasks](SHARED_TASKS.md) |
| Chat thread colors, Light appearance, bubble shape, message metadata | [ChatPage](../src/pages/ChatPage.tsx), [MessageBubble](../src/components/messages/MessageBubble.tsx), [theme tokens](../src/index.css) | [Theme](THEMING.md), [fast path](AI_WORKFLOW.md#fast-path-preflight-for-a-new-task); don't expand to send/sync logic without a reason |
| Chat reply preview, sticker quote | [ReplyPreview](../src/components/messages/ReplyPreview.tsx), [MessageBubble](../src/components/messages/MessageBubble.tsx), [MessageComposer](../src/components/messages/MessageComposer.tsx) | Chat components and message data |
| GIPHY sticker, pause/play, sticker search | [GiphyStickerImage](../src/components/messages/GiphyStickerImage.tsx), [GiphyStickerSearch](../src/components/messages/GiphyStickerSearch.tsx) | Also [StickerPackSheet](../src/components/messages/StickerPackSheet.tsx) |
| Nested bottom sheets, escape/back, layering | [BottomSheet](../src/components/ui/BottomSheet.tsx), [EscapeBackNavigation](../src/components/layout/EscapeBackNavigation.tsx) | [Test workflow](TEST_WORKFLOW.md) |
| Settings swipe back/forward, Android Back | [SettingsPage](../src/pages/SettingsPage.tsx), [PrimaryRouteSwipeSurface](../src/components/layout/PrimaryRouteSwipeSurface.tsx), [primarySwipeNavigation](../src/lib/primarySwipeNavigation.ts) | Route history/gesture behavior |
| Route loading, screen transition, reduced animation | [App](../src/App.tsx), [routeModuleLoaders](../src/components/layout/routeModuleLoaders.ts), [RouteViewportTransition](../src/components/layout/RouteViewportTransition.tsx) | [Test workflow](TEST_WORKFLOW.md), [Theme](THEMING.md) |
| Light/dark/black theme, contrast, a11y | [AppearanceProvider](../src/hooks/AppearanceProvider.tsx), [Button](../src/components/ui/Button.tsx) | [Theme](THEMING.md), [Accessibility audit](ACCESSIBILITY_AUDIT.md) |
| Release history, markdown, cached versions | [ReleaseHistoryPage](../src/pages/ReleaseHistoryPage.tsx), [releaseHistory](../src/lib/releaseHistory.ts), [ReleaseNotesMarkdown](../src/components/ui/ReleaseNotesMarkdown.tsx) | [Versioning](VERSIONING.md) |
| CI gate, branch promotion, Preview deployment | [Focused verifier](../scripts/verify-focused.mjs), [Contracts](../scripts/check-project-contracts.mjs) | [Delivery](DELIVERY.md), [AI workflow](AI_WORKFLOW.md) |
| Appwrite Function, migrations, backend permissions | [Backend workflow](APPWRITE_BACKEND_WORKFLOW.md), [Scratch runbook](SCRATCH_PREVIEW_WORKFLOW.md) | **No single frontend owner**; inspect infrastructure and Functions, never infer target from UI |

## Plan and workflow owners

[Roadmap](PLAN.md) records durable planning; [Issue workflow](ISSUE_WORKFLOW.md) and the live issue/checkpoint record task decisions; [Delivery](DELIVERY.md) owns branch/Preview/CI; [Test workflow](TEST_WORKFLOW.md) owns test selection. Do not treat this map as an authorization or state source.
