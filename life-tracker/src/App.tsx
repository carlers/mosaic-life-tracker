import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { RouteErrorBoundary } from "./components/layout/RouteErrorBoundary";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";
import { PwaPrompt } from "./components/ui/PwaPrompt";
import { AppLayout } from "./components/layout/AppLayout";
import { AuthPage } from "./pages/AuthPage";
import { ResetPasswordPage } from "./pages/ResetPasswordPage";
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
          <Route
            path="/home"
            element={
              <RouteContent label="HomePage" fallback={<HomeRouteFallback />}>
                <HomePage />
              </RouteContent>
            }
          />
          <Route
            path="/explore"
            element={
              <RouteContent label="ExplorePage">
                <ExplorePage />
              </RouteContent>
            }
          />
          <Route
            path="/friends/:friendId"
            element={
              <RouteContent label="FriendCalendarPage">
                <FriendCalendarPage />
              </RouteContent>
            }
          />
          <Route
            path="/notifications"
            element={
              <RouteContent label="NotificationsPage">
                <NotificationsPage />
              </RouteContent>
            }
          />
          <Route
            path="/messages"
            element={
              <RouteContent label="MessagesPage">
                <MessagesPage />
              </RouteContent>
            }
          />
          <Route
            path="/messages/:friendId"
            element={
              <RouteContent label="ChatPage">
                <ChatPage />
              </RouteContent>
            }
          />
          <Route
            path="/account"
            element={
              <RouteContent label="AccountPage">
                <AccountPage />
              </RouteContent>
            }
          />
          <Route
            path="/settings"
            element={
              <RouteContent label="SettingsPage">
                <SettingsPage />
              </RouteContent>
            }
          />
          <Route
            path="/settings/preferences"
            element={
              <RouteContent label="PreferencesPage">
                <PreferencesPage />
              </RouteContent>
            }
          />
          <Route
            path="/settings/notifications"
            element={
              <RouteContent label="NotificationSettingsPage">
                <NotificationSettingsPage />
              </RouteContent>
            }
          />
          <Route
            path="/settings/screen"
            element={<Navigate to="/settings/preferences" replace />}
          />
          <Route
            path="/profile"
            element={
              <RouteContent label="ProfilePage">
                <ProfilePage />
              </RouteContent>
            }
          />
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
