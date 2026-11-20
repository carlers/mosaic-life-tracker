/**
 * The Home update badge is an optional presentation of the shared PWA
 * lifecycle state. Defer the hook from the synchronous Home startup bundle.
 * The global PWA update bridge remains mounted independently in App.tsx.
 */
import { usePwaLifecycle } from '../../hooks/usePwaLifecycle';

export function HomeUpdateIndicator() {
  const { updateAvailable, openUpdatePrompt } = usePwaLifecycle();
  if (!updateAvailable) return null;
  return (
    <button type="button" onClick={() => openUpdatePrompt()}
      aria-label="App update ready" title="Mosaic update ready"
      className="flex h-10 w-9 items-center justify-center rounded-lg focus-visible:ring-2 focus-visible:ring-emerald-400"
      data-home-update-trigger="true">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" aria-hidden="true" />
    </button>
  );
}
