import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { usePwaLifecycle } from "./hooks/usePwaLifecycle";
import { AppLayout } from "./components/layout/AppLayout";



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

// The update/install prompt does not need an initial network module fetch.
const PwaPrompt = lazy(() => import('./components/ui/PwaPrompt').then((m) => ({ default: m.PwaPrompt })));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage').then(({ VerifyEmailPage }) => ({ default: VerifyEmailPage })));
const ResetPasswordPage = lazy(() => import('./pages/ResetPasswordPage').then(({ ResetPasswordPage }) => ({ default: ResetPasswordPage })));


function PwaPromptGate() {
  const state = usePwaLifecycle();
  return state.installAvailable || state.updateAvailable
    ? <Suspense fallback={null}><PwaPrompt /></Suspense>
    : null;
}

// Authentication UI is not part of signed-in Home's startup dependency graph.
const AuthPage = lazy(() => import("./pages/AuthPage")
  .then((module) => ({ default: module.AuthPage })));

// No preloading path needs Backlogs; direct import avoids a redundant memoized loader.
const StoragePage = lazy(() => import('./pages/StoragePage').then((m) => ({ default: m.StoragePage })));
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
  return new URLSearchParams(useLocation().search).get('view') === 'uncompleted'
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

const wrapPage = (label: string, child: ReactNode): ReactNode =>
  <RouteContent label={label}>{child}</RouteContent>;

const protectedPageElements: Record<ProtectedPageId, ReactNode> = {
  home: <RouteContent label="HomePage" fallback={<HomeRouteFallback />}><HomeRoutePage /></RouteContent>,
  backlog: wrapPage('BacklogPage', <BacklogRoute />),
  bucketList: wrapPage('BucketListPage', <BucketListPage />),
  bucketListDetail: wrapPage('BucketListDetailPage', <BucketListDetailPage />),
  explore: wrapPage('ExplorePage', <ExploreRoutePage />),
  friendCalendar: wrapPage('FriendCalendarPage', <FriendCalendarPage />),
  notifications: wrapPage('NotificationsPage', <NotificationsRoutePage />),
  messages: wrapPage('MessagesPage', <MessagesRoutePage />),
  chat: wrapPage('ChatPage', <ChatPage />),
  account: wrapPage('AccountPage', <AccountRoutePage />),
  settings: wrapPage('SettingsPage', <SettingsRoutePage />),
  settingsAccount: wrapPage('SettingsAccountPage', <SettingsRoutePage />),
  settingsData: wrapPage('SettingsDataPage', <SettingsRoutePage />),
  settingsStorage: wrapPage('StoragePage', <StoragePage />),
  settingsAbout: wrapPage('SettingsAboutPage', <SettingsRoutePage />),
  releaseHistory: wrapPage('ReleaseHistoryPage', <ReleaseHistoryRoutePage />),
  preferences: wrapPage('PreferencesPage', <PreferencesRoutePage />),
  preferenceAppearance: wrapPage('PreferencesAppearancePage', <PreferencesRoutePage />),
  preferenceTasks: wrapPage('PreferencesTasksPage', <PreferencesRoutePage />),
  preferenceDayView: wrapPage('PreferencesDayViewPage', <PreferencesRoutePage />),
  preferenceCalendar: wrapPage('PreferencesCalendarPage', <PreferencesRoutePage />),
  preferenceDiary: wrapPage('PreferencesDiaryPage', <PreferencesRoutePage />),
  preferenceSocial: wrapPage('PreferencesSocialPage', <PreferencesRoutePage />),
  preferenceNavigation: wrapPage('PreferencesNavigationPage', <PreferencesRoutePage />),
  notificationSettings: wrapPage('NotificationSettingsPage', <NotificationSettingsRoutePage />),
  profile: wrapPage('ProfilePage', <ProfileRoutePage />),
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/reset-password"
          element={
            wrapPage('ResetPasswordPage', <ResetPasswordPage />)
          }
        />
        <Route
          path="/verify-email"
          element={
            wrapPage('VerifyEmailPage', <VerifyEmailPage />)
          }
        />
        <Route
          path="/login"
          element={
            wrapPage('AuthPage', <AuthPage />)
          }
        />
        <Route
          element={
            wrapPage('AppLayout', <AppLayout />)
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
      <PwaPromptGate />
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
