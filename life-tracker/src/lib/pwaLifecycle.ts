export interface InstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export interface PwaLifecycleSnapshot {
  installAvailable: boolean;
  updateAvailable: boolean;
}

type RegisterServiceWorker = (
  options?: {
    immediate?: boolean;
    onNeedRefresh?: () => void;
    onNeedReload?: () => void;
    onRegisterError?: (error: unknown) => void;
  }
) => (reloadPage?: boolean) => Promise<void>;

let snapshot: PwaLifecycleSnapshot = {
  installAvailable: false,
  updateAvailable: false,
};
let installPrompt: InstallPromptEvent | null = null;
let updateServiceWorker: (() => Promise<void>) | null = null;
let initialized = false;
const listeners = new Set<() => void>();

function publish(next: Partial<PwaLifecycleSnapshot>) {
  snapshot = { ...snapshot, ...next };
  listeners.forEach((listener) => listener());
}

export function subscribeToPwaLifecycle(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getPwaLifecycleSnapshot(): PwaLifecycleSnapshot {
  return snapshot;
}

export function initializePwaLifecycle(
  target: Window,
  register: RegisterServiceWorker
): void {
  if (initialized) return;
  initialized = true;

  target.addEventListener('beforeinstallprompt', ((event: InstallPromptEvent) => {
    event.preventDefault();
    installPrompt = event;
    publish({ installAvailable: true });
  }) as EventListener);
  target.addEventListener('appinstalled', () => {
    installPrompt = null;
    publish({ installAvailable: false });
  });

  updateServiceWorker = register({
    immediate: true,
    onNeedRefresh: () => publish({ updateAvailable: true }),
    // The generated worker only takes over after applyPwaUpdate sends the
    // explicit SKIP_WAITING request, so a reload here is always user-approved.
    onNeedReload: () => target.location.reload(),
    onRegisterError: (error) => {
      console.error('[PWA] Service-worker registration failed:', error);
    },
  });
}

export async function requestPwaInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  const prompt = installPrompt;
  if (!prompt) return 'unavailable';
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (installPrompt === prompt) {
    installPrompt = null;
    publish({ installAvailable: false });
  }
  return outcome;
}

export function dismissPwaInstall(): void {
  installPrompt = null;
  publish({ installAvailable: false });
}

export async function applyPwaUpdate(): Promise<boolean> {
  if (!updateServiceWorker) return false;
  await updateServiceWorker();
  publish({ updateAvailable: false });
  return true;
}

export function dismissPwaUpdate(): void {
  publish({ updateAvailable: false });
}

export function resetPwaLifecycleForTests(): void {
  snapshot = { installAvailable: false, updateAvailable: false };
  installPrompt = null;
  updateServiceWorker = null;
  initialized = false;
  listeners.clear();
}
