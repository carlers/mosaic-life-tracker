import React, { lazy, memo, Suspense } from 'react';
import {
  loadAccountPage,
  loadNotificationsPage,
  loadExplorePage,
  loadHomePage,
  loadMessagesPage,
  loadSettingsPage,
  loadPreferencesPage,
  loadNotificationSettingsPage,
  loadReleaseHistoryPage,
  loadProfilePage,
} from './routeModuleLoaders';

import type { PROTECTED_ROUTES } from '../../lib/protectedRoutes';

// Every route advertising Preview support must supply a readable label and
// lazily rendered component here; a new supported route fails type checking
// until this mapping is updated.
type PreviewPath = Extract<
  (typeof PROTECTED_ROUTES)[number],
  { readonly preview: 'supported' }
>['path'];

const HomePreview = lazy(() =>
  loadHomePage().then(({ HomePage }) => ({ default: HomePage }))
);
const ExplorePreview = lazy(() =>
  loadExplorePage().then(({ ExplorePage }) => ({ default: ExplorePage }))
);
const NotificationsPreview = lazy(() =>
  loadNotificationsPage().then(({ NotificationsPage }) => ({
    default: NotificationsPage,
  }))
);
const MessagesPreview = lazy(() =>
  loadMessagesPage().then(({ MessagesPage }) => ({ default: MessagesPage }))
);
const AccountPreview = lazy(() =>
  loadAccountPage().then(({ AccountPage }) => ({ default: AccountPage }))
);
const SettingsPreview = lazy(() =>
  loadSettingsPage().then(({ SettingsPage }) => ({ default: SettingsPage }))
);
const PreferencesPreview = lazy(() =>
  loadPreferencesPage().then(({ PreferencesPage }) => ({ default: PreferencesPage }))
);
const NotificationSettingsPreview = lazy(() =>
  loadNotificationSettingsPage().then(({ NotificationSettingsPage }) => ({ default: NotificationSettingsPage }))
);
const ReleaseHistoryPreview = lazy(() =>
  loadReleaseHistoryPage().then(({ ReleaseHistoryPage }) => ({ default: ReleaseHistoryPage }))
);
const ProfilePreview = lazy(() =>
  loadProfilePage().then(({ ProfilePage }) => ({ default: ProfilePage }))
);

const LABELS: Record<PreviewPath, string> = {
  '/home': 'Home',
  '/explore': 'Explore',
  '/notifications': 'Alerts',
  '/messages': 'Chat',
  '/account': 'Me',
  '/settings': 'Settings',
  '/settings/preferences': 'Preferences',
  '/settings/notifications': 'Notification settings',
  '/settings/releases': 'Release history',
  '/profile': 'Profile',
};

function isPreviewPath(pathname: string): pathname is PreviewPath {
  return pathname in LABELS;
}

const Fallback: React.FC<{ pathname: PreviewPath }> = ({ pathname }) => (
  <div className="h-full min-h-[60vh] bg-[#111111] text-white">
    <div className="border-b border-[#333333] px-4 py-3">
      <div className="text-lg font-bold">{LABELS[pathname]}</div>
    </div>
    <div className="space-y-3 px-4 py-4" aria-hidden="true">
      <div className="h-10 rounded-xl bg-[#1E1E1E]" />
      <div className="h-20 rounded-xl bg-[#1E1E1E]" />
      <div className="h-20 rounded-xl bg-[#1E1E1E]" />
    </div>
  </div>
);

const PrimaryRoutePreviewComponent: React.FC<{ pathname: string }> = ({ pathname }) => {
  if (!isPreviewPath(pathname)) return null;

  let content: React.ReactNode;
  switch (pathname) {
    case '/home':
      content = <HomePreview />;
      break;
    case '/explore':
      content = <ExplorePreview />;
      break;
    case '/notifications':
      content = <NotificationsPreview preview />;
      break;
    case '/messages':
      content = <MessagesPreview />;
      break;
    case '/account':
      content = <AccountPreview />;
      break;
    case '/settings':
      content = <SettingsPreview />;
      break;
    case '/settings/preferences':
      content = <PreferencesPreview />;
      break;
    case '/settings/notifications':
      content = <NotificationSettingsPreview />;
      break;
    case '/settings/releases':
      content = <ReleaseHistoryPreview />;
      break;
    case '/profile':
      content = <ProfilePreview />;
      break;
    default: {
      // Compile-time exhaustive check for a newly enabled Preview route.
      const unreachable: never = pathname;
      throw new Error('Unsupported route preview: ' + unreachable);
    }
  }

  return <Suspense fallback={<Fallback pathname={pathname} />}>{content}</Suspense>;
};

export const PrimaryRoutePreview = memo(PrimaryRoutePreviewComponent);
PrimaryRoutePreview.displayName = 'PrimaryRoutePreview';
