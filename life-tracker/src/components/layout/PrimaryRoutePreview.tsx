import React, { lazy, memo, Suspense } from 'react';

type PreviewPath =
  | '/home'
  | '/explore'
  | '/notifications'
  | '/messages'
  | '/account'
  | '/settings';

const loadHome = () =>
  import('../../pages/HomePage').then(({ HomePage }) => ({ default: HomePage }));
const loadExplore = () =>
  import('../../pages/ExplorePage').then(({ ExplorePage }) => ({
    default: ExplorePage,
  }));
const loadNotifications = () =>
  import('./ComingSoon').then(({ ComingSoon }) => ({ default: ComingSoon }));
const loadMessages = () =>
  import('../../pages/MessagesPage').then(({ MessagesPage }) => ({
    default: MessagesPage,
  }));
const loadAccount = () =>
  import('../../pages/AccountPage').then(({ AccountPage }) => ({
    default: AccountPage,
  }));
const loadSettings = () =>
  import('../../pages/SettingsPage').then(({ SettingsPage }) => ({
    default: SettingsPage,
  }));

const HomePreview = lazy(loadHome);
const ExplorePreview = lazy(loadExplore);
const NotificationsPreview = lazy(loadNotifications);
const MessagesPreview = lazy(loadMessages);
const AccountPreview = lazy(loadAccount);
const SettingsPreview = lazy(loadSettings);

const LABELS: Record<PreviewPath, string> = {
  '/home': 'Home',
  '/explore': 'Explore',
  '/notifications': 'Alerts',
  '/messages': 'Chat',
  '/account': 'Me',
  '/settings': 'Settings',
};

function isPreviewPath(pathname: string): pathname is PreviewPath {
  return pathname in LABELS;
}

export function preloadPrimaryRoute(pathname: string | null) {
  if (!pathname || !isPreviewPath(pathname)) return;

  let promise: Promise<unknown>;
  switch (pathname) {
    case '/home':
      promise = loadHome();
      break;
    case '/explore':
      promise = loadExplore();
      break;
    case '/notifications':
      promise = loadNotifications();
      break;
    case '/messages':
      promise = loadMessages();
      break;
    case '/account':
      promise = loadAccount();
      break;
    case '/settings':
      promise = loadSettings();
      break;
  }

  void promise.catch((error) => {
    console.warn('[PrimaryRoutePreview] preload failed:', error);
  });
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

const PrimaryRoutePreviewComponent: React.FC<{ pathname: string }> = ({
  pathname,
}) => {
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
      content = <NotificationsPreview />;
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
  }

  return (
    <Suspense fallback={<Fallback pathname={pathname} />}>{content}</Suspense>
  );
};

export const PrimaryRoutePreview = memo(PrimaryRoutePreviewComponent);
PrimaryRoutePreview.displayName = 'PrimaryRoutePreview';
