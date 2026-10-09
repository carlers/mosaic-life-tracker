function memoizeImport<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    if (!pending) {
      pending = load().catch((error) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  };
}

export const loadHomePage = memoizeImport(() => import('../../pages/HomePage'));
export const loadAccountPage = memoizeImport(() => import('../../pages/AccountPage'));
export const loadSettingsPage = memoizeImport(() => import('../../pages/SettingsPage'));
export const loadPreferencesPage = memoizeImport(() => import('../../pages/PreferencesPage'));
export const loadNotificationSettingsPage = memoizeImport(() => import('../../pages/NotificationSettingsPage'));
export const loadProfilePage = memoizeImport(() => import('../../pages/ProfilePage'));
export const loadExplorePage = memoizeImport(() => import('../../pages/ExplorePage'));
export const loadFriendCalendarPage = memoizeImport(() => import('../../pages/FriendCalendarPage'));
export const loadMessagesPage = memoizeImport(() => import('../../pages/MessagesPage'));
export const loadNotificationsPage = memoizeImport(() => import('../../pages/NotificationsPage'));
export const loadChatPage = memoizeImport(() => import('../../pages/ChatPage'));
export const loadComingSoon = memoizeImport(() => import('./ComingSoon'));
