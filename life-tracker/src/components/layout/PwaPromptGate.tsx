/**
 * Non-blocking PWA install/update prompt bridge.
 * Moved out of the Home startup closure; lifecycle/auth behavior is unchanged.
 * Both this bridge and the visual prompt remain within existing error boundary.
 */
import { lazy, Suspense } from 'react';
import { usePwaLifecycle } from '../../hooks/usePwaLifecycle';

const PwaPrompt = lazy(() =>
  import('../ui/PwaPrompt').then((m) => ({ default: m.PwaPrompt })),
);

export default function PwaPromptGate() {
  const { installAvailable, updateAvailable } = usePwaLifecycle();
  if (!installAvailable && !updateAvailable) return null;
  return <Suspense fallback={null}><PwaPrompt /></Suspense>;
}
