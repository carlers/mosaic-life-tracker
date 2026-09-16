import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout';
import { RouteErrorBoundary } from './components/layout/RouteErrorBoundary';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { HomePage } from './pages/HomePage';
import { ComingSoon } from './components/layout/ComingSoon';
import { AuthPage } from './pages/AuthPage';
import { AccountPage } from './pages/AccountPage';
import { SettingsPage } from './pages/SettingsPage';
import { ProfilePage } from './pages/ProfilePage';
import { ExplorePage } from './pages/ExplorePage';
import { FriendCalendarPage } from './pages/FriendCalendarPage';
import { MessagesPage } from './pages/MessagesPage';
import { ChatPage } from './pages/ChatPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<AuthPage />} />
        <Route element={<AppLayout />}>
          <Route path="/" element={<Navigate to="/home" replace />} />
          <Route
            path="/home"
            element={
              <RouteErrorBoundary label="HomePage">
                <HomePage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/explore"
            element={
              <RouteErrorBoundary label="ExplorePage">
                <ExplorePage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/friends/:friendId"
            element={
              <RouteErrorBoundary label="FriendCalendarPage">
                <FriendCalendarPage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/notifications"
            element={
              <RouteErrorBoundary label="Notifications">
                <ComingSoon />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/messages"
            element={
              <RouteErrorBoundary label="MessagesPage">
                <MessagesPage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/messages/:friendId"
            element={
              <RouteErrorBoundary label="ChatPage">
                <ChatPage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/account"
            element={
              <RouteErrorBoundary label="AccountPage">
                <AccountPage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/settings"
            element={
              <RouteErrorBoundary label="SettingsPage">
                <SettingsPage />
              </RouteErrorBoundary>
            }
          />
          <Route
            path="/profile"
            element={
              <RouteErrorBoundary label="ProfilePage">
                <ProfilePage />
              </RouteErrorBoundary>
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
    </ErrorBoundary>
  );
}

export default AppWithErrorBoundary;
