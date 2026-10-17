import { markStartup } from '../../lib/startupMetrics';

type ShellComponent = (typeof import('./AppDataShell'))['AppDataShell'];
let loadedAppDataShell: ShellComponent | null = null;
const shellListeners = new Set<() => void>();
export const getLoadedAppDataShell = (): ShellComponent | null => loadedAppDataShell;
export const subscribeLoadedAppDataShell = (listener: () => void): (() => void) => {
  shellListeners.add(listener);
  return () => { shellListeners.delete(listener); };
};

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

// Shared lazy module loader: returning accounts warm this before React mounts,
// while AppLayout reuses the same promise and resets naturally on failure.
export const loadAppDataShell = memoizeImport(() => {
  markStartup('app-shell:import-start');
  return import('./AppDataShell').then((module) => {
    loadedAppDataShell = module.AppDataShell;
    for (const listener of shellListeners) listener();
    markStartup('app-shell:module-ready');
    return module;
  });
});

export const loadHomePage = memoizeImport(() => import('../../pages/HomePage'));
export const loadAccountPage = memoizeImport(() => import('../../pages/AccountPage'));
export const loadSettingsPage = memoizeImport(() => import('../../pages/SettingsPage'));
export const loadReleaseHistoryPage = memoizeImport(() => import('../../pages/ReleaseHistoryPage'));
export const loadPreferencesPage = memoizeImport(() => import('../../pages/PreferencesPage'));
export const loadNotificationSettingsPage = memoizeImport(() => import('../../pages/NotificationSettingsPage'));
export const loadProfilePage = memoizeImport(() => import('../../pages/ProfilePage'));
export const loadExplorePage = memoizeImport(() => import('../../pages/ExplorePage'));
export const loadFriendCalendarPage = memoizeImport(() => import('../../pages/FriendCalendarPage'));
export const loadMessagesPage = memoizeImport(() => import('../../pages/MessagesPage'));
export const loadNotificationsPage = memoizeImport(() => import('../../pages/NotificationsPage'));
export const loadChatPage = memoizeImport(() => import('../../pages/ChatPage'));
export const loadComingSoon = memoizeImport(() => import('./ComingSoon'));
