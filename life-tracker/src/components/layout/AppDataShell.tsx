import React from 'react';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { MainLayout, type MainLayoutProps } from './MainLayout';
import { RouteViewportTransition } from './RouteViewportTransition';
import { EscapeBackNavigation } from './EscapeBackNavigation';
import { markStartup } from '../../lib/startupMetrics';
import { KeyboardShortcutsProvider } from '../../hooks/KeyboardShortcutsProvider';
// Keep optional completion visuals off the login/Home initial static closure.
// This layer mounts immediately and loads asynchronously without blocking app UI.
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
          <EscapeBackNavigation />
          <RouteViewportTransition
            pathname={layoutProps.routeKey ?? '/home'}
            direction={layoutProps.routeTransitionDirection ?? 'none'}
          >
            <MainLayout {...layoutProps} />
          </RouteViewportTransition>
          </KeyboardShortcutsProvider>
        </ConversationsProvider>
      </FriendsProvider>
    </AppearanceProvider>
  );
};
