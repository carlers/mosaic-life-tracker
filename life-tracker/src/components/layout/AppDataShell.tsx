import React from 'react';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { MainLayout, type MainLayoutProps } from './MainLayout';
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
          <MainLayout {...layoutProps} />
        </ConversationsProvider>
      </FriendsProvider>
    </AppearanceProvider>
  );
};
