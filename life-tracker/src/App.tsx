import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { PwaPrompt } from "./components/ui/PwaPrompt";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthPage } from "./pages/AuthPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
import { PROTECTED_ROUTES, type ProtectedPageId } from './lib/protectedRoutes';
import {
  loadAccountPage,
  loadChatPage,
  loadNotificationsPage,
  loadExplorePage,
  loadFriendCalendarPage,
  loadHomePage,
  loadMessagesPage,
  loadPreferencesPage,
  loadNotificationSettingsPage,
  loadProfilePage,
  loadSettingsPage,
  loadReleaseHistoryPage,
} from "./components/layout/routeModuleLoaders";

const HomePage = lazy(() =>
  loadHomePage().then(({ HomePage }) => ({ default: HomePage })),
);
const AccountPage = lazy(() =>
  loadAccountPage().then(({ AccountPage }) => ({ default: AccountPage })),
);
const SettingsPage = lazy(() =>
  loadSettingsPage().then(({ SettingsPage }) => ({ default: SettingsPage })),
);
const ReleaseHistoryPage = lazy(() =>
  loadReleaseHistoryPage().then(({ ReleaseHistoryPage }) => ({ default: ReleaseHistoryPage })),
);
const PreferencesPage = lazy(() =>
  loadPreferencesPage().then(({ PreferencesPage }) => ({
    default: PreferencesPage,
  })),
);
const NotificationSettingsPage = lazy(() =>
  loadNotificationSettingsPage().then(({ NotificationSettingsPage }) => ({
    default: NotificationSettingsPage,
  })),
);
const ProfilePage = lazy(() =>
  loadProfilePage().then(({ ProfilePage }) => ({ default: ProfilePage })),
);
const ExplorePage = lazy(() =>
  loadExplorePage().then(({ ExplorePage }) => ({ default: ExplorePage })),
);
const FriendCalendarPage = lazy(() =>
  loadFriendCalendarPage().then(({ FriendCalendarPage }) => ({
    default: FriendCalendarPage,
  })),
);
const MessagesPage = lazy(() =>
  loadMessagesPage().then(({ MessagesPage }) => ({ default: MessagesPage })),
);
const ChatPage = lazy(() =>
  loadChatPage().then(({ ChatPage }) => ({ default: ChatPage })),
);
const NotificationsPage = lazy(() =>
  loadNotificationsPage().then(({ NotificationsPage }) => ({
    default: NotificationsPage,
  })),
);

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
  home: <RouteContent label="HomePage" fallback={<HomeRouteFallback />}><HomePage /></RouteContent>,
  explore: <RouteContent label="ExplorePage"><ExplorePage /></RouteContent>,
  friendCalendar: <RouteContent label="FriendCalendarPage"><FriendCalendarPage /></RouteContent>,
  notifications: <RouteContent label="NotificationsPage"><NotificationsPage /></RouteContent>,
  messages: <RouteContent label="MessagesPage"><MessagesPage /></RouteContent>,
  chat: <RouteContent label="ChatPage"><ChatPage /></RouteContent>,
  account: <RouteContent label="AccountPage"><AccountPage /></RouteContent>,
  settings: <RouteContent label="SettingsPage"><SettingsPage /></RouteContent>,
  releaseHistory: <RouteContent label="ReleaseHistoryPage"><ReleaseHistoryPage /></RouteContent>,
  preferences: <RouteContent label="PreferencesPage"><PreferencesPage /></RouteContent>,
  notificationSettings: <RouteContent label="NotificationSettingsPage"><NotificationSettingsPage /></RouteContent>,
  profile: <RouteContent label="ProfilePage"><ProfilePage /></RouteContent>,
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
