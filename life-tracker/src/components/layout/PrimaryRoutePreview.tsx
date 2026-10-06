import React, { lazy, memo, Suspense } from 'react';
import {
  loadAccountPage,
  loadComingSoon,
  loadExplorePage,
  loadHomePage,
  loadMessagesPage,
  loadSettingsPage,
} from './routeModuleLoaders';

type PreviewPath =
  | '/home'
  | '/explore'
  | '/notifications'
  | '/messages'
  | '/account'
  | '/settings';

const HomePreview = lazy(() =>
  loadHomePage().then(({ HomePage }) => ({ default: HomePage }))
);
const ExplorePreview = lazy(() =>
  loadExplorePage().then(({ ExplorePage }) => ({ default: ExplorePage }))
);
const NotificationsPreview = lazy(() =>
  loadComingSoon().then(({ ComingSoon }) => ({ default: ComingSoon }))
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

  return <Suspense fallback={<Fallback pathname={pathname} />}>{content}</Suspense>;
};

export const PrimaryRoutePreview = memo(PrimaryRoutePreviewComponent);
PrimaryRoutePreview.displayName = 'PrimaryRoutePreview';
