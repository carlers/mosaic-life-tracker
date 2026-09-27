import React from 'react';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { MainLayout, type MainLayoutProps } from './MainLayout';

interface AppDataShellProps extends MainLayoutProps {
  includeConversations: boolean;
}

export const AppDataShell: React.FC<AppDataShellProps> = ({
  includeConversations,
  ...layoutProps
}) => (
  <AppearanceProvider>
    <FriendsProvider>
      <ConversationsProvider includeConversations={includeConversations}>
        <MainLayout {...layoutProps} />
      </ConversationsProvider>
    </FriendsProvider>
  </AppearanceProvider>
);
