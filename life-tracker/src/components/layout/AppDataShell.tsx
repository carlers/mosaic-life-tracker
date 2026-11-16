import React from 'react';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { MainLayout, type MainLayoutProps } from './MainLayout';
import { RouteViewportTransition } from './RouteViewportTransition';
import { EscapeBackNavigation } from './EscapeBackNavigation';
import { markStartup } from '../../lib/startupMetrics';
import { KeyboardShortcutsProvider } from '../../hooks/KeyboardShortcutsProvider';
import { GestureShortcutsProvider } from '../../hooks/GestureShortcutsProvider';
// Keep optional completion visuals off the login/Home initial static closure.
// This layer mounts immediately and loads asynchronously without blocking app UI.
const OtherPagesWallpaper = React.lazy(() => import('./OtherPagesWallpaper'));
const CompletionFeedbackLayer = React.lazy(async () => ({
  default: (await import('./CompletionFeedbackLayer')).CompletionFeedbackLayer,
}));

interface AppDataShellProps extends MainLayoutProps {
  includeConversations: boolean;
}

export const AppDataShell: React.FC<AppDataShellProps> = ({
  includeConversations,
  ...layoutProps
}) => {
  React.useEffect(() => {
    markStartup('app-data-shell:mounted');
  }, []);

  return (
    <AppearanceProvider>
      <React.Suspense fallback={null}><CompletionFeedbackLayer /></React.Suspense>
      <FriendsProvider>
        <ConversationsProvider includeConversations={includeConversations}>
          <KeyboardShortcutsProvider>
          <GestureShortcutsProvider>
          <EscapeBackNavigation />
          <RouteViewportTransition
            pathname={layoutProps.routeKey ?? '/home'}
            direction={layoutProps.routeTransitionDirection ?? 'none'}
          >
            <MainLayout {...layoutProps} wallpaper={
              layoutProps.routeKey !== '/home' && !layoutProps.routeKey?.startsWith('/friends/')
                ? <React.Suspense fallback={null}><OtherPagesWallpaper /></React.Suspense>
                : null
            } />
          </RouteViewportTransition>
          </GestureShortcutsProvider>
          </KeyboardShortcutsProvider>
        </ConversationsProvider>
      </FriendsProvider>
    </AppearanceProvider>
  );
};
