import React from 'react';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { MainLayout, type MainLayoutProps } from './MainLayout';
import { RouteViewportTransition } from './RouteViewportTransition';
import { EscapeBackNavigation } from './EscapeBackNavigation';
import { markStartup } from '../../lib/startupMetrics';

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
      <FriendsProvider>
        <ConversationsProvider includeConversations={includeConversations}>
          <EscapeBackNavigation />
          <RouteViewportTransition
            pathname={layoutProps.routeKey ?? '/home'}
            direction={layoutProps.routeTransitionDirection ?? 'none'}
          >
            <MainLayout {...layoutProps} />
          </RouteViewportTransition>
        </ConversationsProvider>
      </FriendsProvider>
    </AppearanceProvider>
  );
};
