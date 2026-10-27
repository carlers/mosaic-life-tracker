import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { PwaPrompt } from "./components/ui/PwaPrompt";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthPage } from "./pages/AuthPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { PROTECTED_ROUTES, type ProtectedPageId } from './lib/protectedRoutes';
import { loadChatPage, loadFriendCalendarPage } from "./components/layout/routeModuleLoaders";
import {
  HomeRoutePage,
  AccountRoutePage,
  SettingsRoutePage,
  ReleaseHistoryRoutePage,
  PreferencesRoutePage,
  NotificationSettingsRoutePage,
  ProfileRoutePage,
  ExploreRoutePage,
  MessagesRoutePage,
  NotificationsRoutePage,
} from "./components/layout/routePageComponents";

// No preloading path needs Backlogs; direct import avoids a redundant memoized loader.
const BacklogPage = lazy(() => import('./pages/BacklogPage'));
const UncompletedTasksPage = lazy(() => import('./pages/UncompletedTasksPage'));
const BucketListPage = lazy(() => import('./pages/BucketListPage'));
const BucketListDetailPage = lazy(() => import('./pages/BucketListDetailPage'));
const FriendCalendarPage = lazy(() =>
  loadFriendCalendarPage().then(({ FriendCalendarPage }) => ({
    default: FriendCalendarPage,
  })),
);
const ChatPage = lazy(() =>
  loadChatPage().then(({ ChatPage }) => ({ default: ChatPage })),
);

function BacklogRoute() {
  const { search } = useLocation();
  return new URLSearchParams(search).get('view') === 'uncompleted'
    ? <UncompletedTasksPage /> : <BacklogPage />;
}

function RouteShellFallback({ label }: { label: string }) {
  const pageName = label.replace(/Page$/, "");
  return (
    <div
      className="min-h-[60vh] bg-[#111111] px-4 py-4 space-y-3"
      role="status"
      aria-label={`Opening ${pageName}`}
    >
      <div className="h-10 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
      <div className="h-20 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
      <div className="h-20 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
      <span className="sr-only">Opening {pageName}</span>
    </div>
  );
}

function RouteContent({
  label,
  children,
  fallback,
}: {
  label: string;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  return (
    <RouteErrorBoundary label={label}>
      <Suspense
        fallback={
          fallback ?? <RouteShellFallback label={label} />
        }
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

function HomeRouteFallback() {
  return (
    <div
      className="h-full min-h-[60vh] bg-[#111111] px-4 py-4 space-y-3"
      role="status"
      aria-label="Opening Home"
    >
      <div className="h-10 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
      <div className="h-24 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
      <div className="h-24 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
      <div className="h-16 rounded-xl bg-[#1A1A1A]" aria-hidden="true" />
    </div>
  );
}

const protectedPageElements: Record<ProtectedPageId, ReactNode> = {
  home: <RouteContent label="HomePage" fallback={<HomeRouteFallback />}><HomeRoutePage /></RouteContent>,
  backlog: <RouteContent label="BacklogPage"><BacklogRoute /></RouteContent>,
  bucketList: <RouteContent label="BucketListPage"><BucketListPage /></RouteContent>,
  bucketListDetail: <RouteContent label="BucketListDetailPage"><BucketListDetailPage /></RouteContent>,
  explore: <RouteContent label="ExplorePage"><ExploreRoutePage /></RouteContent>,
  friendCalendar: <RouteContent label="FriendCalendarPage"><FriendCalendarPage /></RouteContent>,
  notifications: <RouteContent label="NotificationsPage"><NotificationsRoutePage /></RouteContent>,
  messages: <RouteContent label="MessagesPage"><MessagesRoutePage /></RouteContent>,
  chat: <RouteContent label="ChatPage"><ChatPage /></RouteContent>,
  account: <RouteContent label="AccountPage"><AccountRoutePage /></RouteContent>,
  settings: <RouteContent label="SettingsPage"><SettingsRoutePage /></RouteContent>,
  releaseHistory: <RouteContent label="ReleaseHistoryPage"><ReleaseHistoryRoutePage /></RouteContent>,
  preferences: <RouteContent label="PreferencesPage"><PreferencesRoutePage /></RouteContent>,
  notificationSettings: <RouteContent label="NotificationSettingsPage"><NotificationSettingsRoutePage /></RouteContent>,
  profile: <RouteContent label="ProfilePage"><ProfileRoutePage /></RouteContent>,
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/reset-password"
          element={
            <RouteContent label="ResetPasswordPage">
              <ResetPasswordPage />
            </RouteContent>
          }
        />
        <Route
          path="/login"
          element={
            <RouteContent label="AuthPage">
              <AuthPage />
            </RouteContent>
          }
        />
        <Route
          element={
            <RouteContent label="AppLayout">
              <AppLayout />
            </RouteContent>
          }
        >
          <Route path="/" element={<Navigate to="/home" replace />} />
          {PROTECTED_ROUTES.map((route) => (
            <Route
              key={route.path}
              path={route.path}
              element={route.kind === 'redirect'
                ? <Navigate to={route.redirectTo} replace />
                : protectedPageElements[route.id]}
            />
          ))}
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export function AppWithErrorBoundary() {
  return (
    <ErrorBoundary label="root">
      <App />
      <PwaPrompt />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
