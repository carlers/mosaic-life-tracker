import React, { memo, Suspense } from 'react';
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
} from './routePageComponents';

import type { PROTECTED_ROUTES } from '../../lib/protectedRoutes';

// Every route advertising Preview support must supply a readable label and
// lazily rendered component here; a new supported route fails type checking
// until this mapping is updated.
type PreviewPath = Extract<
  (typeof PROTECTED_ROUTES)[number],
  { readonly preview: 'supported' }
>['path'];

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

// A route added to the supported registry must also have a lazy preview.
const PAGES: Record<PreviewPath, React.ComponentType> = {
  '/home': HomeRoutePage,
  '/explore': ExploreRoutePage,
  '/notifications': () => <NotificationsRoutePage preview />,
  '/messages': MessagesRoutePage,
  '/account': AccountRoutePage,
  '/settings': SettingsRoutePage,
  '/settings/preferences': PreferencesRoutePage,
  '/settings/notifications': NotificationSettingsRoutePage,
  '/settings/releases': ReleaseHistoryRoutePage,
  '/profile': ProfileRoutePage,
};

const PrimaryRoutePreviewComponent: React.FC<{ pathname: string }> = ({ pathname }) => {
  if (!isPreviewPath(pathname)) return null;
  const Page = PAGES[pathname];
  return <Suspense fallback={<Fallback pathname={pathname} />}><Page /></Suspense>;
};

export const PrimaryRoutePreview = memo(PrimaryRoutePreviewComponent);
PrimaryRoutePreview.displayName = 'PrimaryRoutePreview';
