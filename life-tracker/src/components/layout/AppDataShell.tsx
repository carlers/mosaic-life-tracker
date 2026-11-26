import React from 'react';
import { AppearanceProvider } from '../../hooks/AppearanceProvider';
import { AppearanceContext } from '../../hooks/appearanceContext';
import { FriendsProvider } from '../../hooks/FriendsProvider';
import { ConversationsProvider } from '../../hooks/ConversationsProvider';
import { MainLayout, type MainLayoutProps } from './MainLayout';
import { RouteViewportTransition } from './RouteViewportTransition';
import { EscapeBackNavigation } from './EscapeBackNavigation';
import { markStartup } from '../../lib/startupMetrics';
import { useDeviceEdgeToEdge } from '../../lib/immersiveDisplay';
import { KeyboardShortcutsProvider } from '../../hooks/KeyboardShortcutsProvider';
import { GestureShortcutsProvider } from '../../hooks/GestureShortcutsProvider';
// Keep optional completion visuals off the login/Home initial static closure.
// This layer mounts immediately and loads asynchronously without blocking app UI.
const OtherPagesWallpaper = React.lazy(() => import('./OtherPagesWallpaper'));
const CompletionFeedbackLayer = React.lazy(async () => ({
  default: (await import('./CompletionFeedbackLayer')).CompletionFeedbackLayer,
}));

/** Best-effort browser chrome color only; Android owns native system bars. */
function EdgeToEdgeChrome({ enabled }: { enabled: boolean }) {
  const theme = React.useContext(AppearanceContext)?.resolvedTheme;
  React.useEffect(() => {
    if (!enabled || !theme) return;
    const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    if (!meta) return;
    const previous = meta.content;
    meta.content = theme === 'light' ? '#f7f7f8' : theme === 'black' ? '#000000' : '#111111';
    return () => { meta.content = previous; };
  }, [enabled, theme]);
  return null;
}

interface AppDataShellProps extends MainLayoutProps {
  includeConversations: boolean;
}

export const AppDataShell: React.FC<AppDataShellProps> = ({
  includeConversations,
  ...layoutProps
}) => {
  // Resolve device-only display state only after the authenticated data shell
  // loads. Login/startup must not eagerly pull in immersive controls.
  const edgeToEdge = useDeviceEdgeToEdge(layoutProps.ownerId);
  // The ordinary route shell can remount for Chat. Keep dismissal independent
  // of that temporary route suppression and never carry it between owners.
  const [dockState, setDockState] = React.useState<{ ownerId?: string; hidden: boolean }>({ ownerId: layoutProps.ownerId, hidden: false });
  if (dockState.ownerId !== layoutProps.ownerId) {
    setDockState({ ownerId: layoutProps.ownerId, hidden: false });
  }
  const floatingNavHidden = dockState.ownerId === layoutProps.ownerId && dockState.hidden;
  const onFloatingNavHiddenChange = React.useCallback((hidden: boolean) => {
    setDockState({ ownerId: layoutProps.ownerId, hidden });
  }, [layoutProps.ownerId]);
  React.useEffect(() => {
    markStartup('app-data-shell:mounted');
  }, []);

  return (
    <AppearanceProvider>
      <EdgeToEdgeChrome enabled={edgeToEdge} />
      <React.Suspense fallback={null}><CompletionFeedbackLayer /></React.Suspense>
      <FriendsProvider>
        <ConversationsProvider includeConversations={includeConversations}>
          <KeyboardShortcutsProvider>
          <GestureShortcutsProvider>
          <EscapeBackNavigation />
          <RouteViewportTransition
            pathname={layoutProps.routeKey ?? '/home'}
            direction={layoutProps.routeTransitionDirection ?? 'none'}
            edgeToEdge={edgeToEdge}
          >
            <MainLayout {...layoutProps} edgeToEdge={edgeToEdge} floatingNavHidden={floatingNavHidden}
              onFloatingNavHiddenChange={onFloatingNavHiddenChange} wallpaper={
              <React.Suspense fallback={null}><OtherPagesWallpaper /></React.Suspense>
            } />
          </RouteViewportTransition>
          </GestureShortcutsProvider>
          </KeyboardShortcutsProvider>
        </ConversationsProvider>
      </FriendsProvider>
    </AppearanceProvider>
  );
};
