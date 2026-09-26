import { lazy, Suspense, type ReactNode } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { Spinner } from './components/ui/Spinner';
import { PwaPrompt } from './components/ui/PwaPrompt';

const HomePage = lazy(() =>
  import('./pages/HomePage').then(({ HomePage }) => ({ default: HomePage }))
);
const AuthPage = lazy(() =>
  import('./pages/AuthPage').then(({ AuthPage }) => ({ default: AuthPage }))
);
const AccountPage = lazy(() =>
  import('./pages/AccountPage').then(({ AccountPage }) => ({ default: AccountPage }))
);
const SettingsPage = lazy(() =>
  import('./pages/SettingsPage').then(({ SettingsPage }) => ({ default: SettingsPage }))
);
const PreferencesPage = lazy(() =>
  import('./pages/PreferencesPage').then(({ PreferencesPage }) => ({
    default: PreferencesPage,
  }))
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then(({ ProfilePage }) => ({ default: ProfilePage }))
);
const ExplorePage = lazy(() =>
  import('./pages/ExplorePage').then(({ ExplorePage }) => ({ default: ExplorePage }))
);
const FriendCalendarPage = lazy(() =>
  import('./pages/FriendCalendarPage').then(({ FriendCalendarPage }) => ({
    default: FriendCalendarPage,
  }))
);
const MessagesPage = lazy(() =>
  import('./pages/MessagesPage').then(({ MessagesPage }) => ({ default: MessagesPage }))
);
const ChatPage = lazy(() =>
  import('./pages/ChatPage').then(({ ChatPage }) => ({ default: ChatPage }))
);
const ComingSoon = lazy(() =>
  import('./components/layout/ComingSoon').then(({ ComingSoon }) => ({
    default: ComingSoon,
  }))
);

function RouteContent({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <RouteErrorBoundary label={label}>
      <Suspense
        fallback={
          <div className="min-h-[60vh] flex items-center justify-center">
            <Spinner size="w-8 h-8" />
          </div>
        }
      >
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={
            <RouteContent label="AuthPage">
              <AuthPage />
            </RouteContent>
          }
        />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/home"
            element={
              <RouteContent label="HomePage">
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
              <RouteContent label="Notifications">
                <ComingSoon />
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
