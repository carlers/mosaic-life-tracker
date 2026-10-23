import { markStartup } from '../../lib/startupMetrics';

// Returning accounts import this module before React mounts. Keep a read-only
// snapshot of the resolved component so an already-fetched route need not
// suspend again merely to resolve the same React.lazy Promise.
type ShellComponent = (typeof import('./AppDataShell'))['AppDataShell'];
let loadedShell: ShellComponent | null = null;
const shellListeners = new Set<() => void>();

export function getLoadedAppDataShell(): ShellComponent | null {
  return loadedShell;
}

export function subscribeLoadedAppDataShell(listener: () => void): () => void {
  shellListeners.add(listener);
  return () => { shellListeners.delete(listener); };
}

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
    loadedShell = module.AppDataShell;
    markStartup('app-shell:module-ready');
    for (const listener of shellListeners) listener();
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
