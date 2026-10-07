import { getConnectivitySnapshot } from './connectivity';
import { sendAppAction } from './appAction';

const PUSH_STATE_DB = 'mosaic_push_state';
const PUSH_STATE_STORE = 'meta';
const ACTIVE_USER_KEY = 'active-user';

export type PushNotificationStatus =
  | 'checking'
  | 'unsupported'
  | 'install-required'
  | 'blocked'
  | 'unconfigured'
  | 'available'
  | 'enabled';

export interface PushNotificationState {
  status: PushNotificationStatus;
  enabled: boolean;
  label: string;
}

let markerWrite: Promise<void> = Promise.resolve();

function openPushStateDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(PUSH_STATE_DB, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(PUSH_STATE_STORE)) {
        request.result.createObjectStore(PUSH_STATE_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function writeActiveUser(userId: string | null): Promise<void> {
  try {
    const db = await openPushStateDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(PUSH_STATE_STORE, 'readwrite');
      const store = tx.objectStore(PUSH_STATE_STORE);
      const request = userId
        ? store.put(userId, ACTIVE_USER_KEY)
        : store.delete(ACTIVE_USER_KEY);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.warn('[pushNotifications] active-user marker failed:', error);
  }
}

export function setPushActiveUser(userId: string | null): Promise<void> {
  markerWrite = markerWrite.then(() => writeActiveUser(userId));
  return markerWrite;
}

function isIosDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const classicIos = /iPhone|iPad|iPod/i.test(ua);
  const ipadDesktopMode =
    navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  return classicIos || ipadDesktopMode;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined') return false;
  const navigatorWithStandalone = navigator as Navigator & {
    standalone?: boolean;
  };
  return (
    window.matchMedia?.('(display-mode: standalone)').matches === true ||
    navigatorWithStandalone.standalone === true
  );
}

function supportsWebPush(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

function state(
  status: PushNotificationStatus,
  label: string,
  enabled = false
): PushNotificationState {
  return { status, label, enabled };
}

function supportState(): PushNotificationState | null {
  if (!supportsWebPush()) {
    return state('unsupported', 'Not supported on this device');
  }
  if (isIosDevice() && !isStandaloneDisplay()) {
    return state(
      'install-required',
      'Install Mosaic to your Home Screen first'
    );
  }
  if (Notification.permission === 'denied') {
    return state('blocked', 'Blocked in system or browser settings');
  }
  return null;
}

async function getLocalSubscription(): Promise<PushSubscription | null> {
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return null;
  return registration.pushManager.getSubscription();
}

export async function getPushNotificationState(): Promise<PushNotificationState> {
  const unsupported = supportState();
  if (unsupported) return unsupported;

  const subscription = await getLocalSubscription();
  if (subscription) {
    return state('enabled', 'Enabled on this device', true);
  }

  if (getConnectivitySnapshot().status !== 'online') {
    return state('available', 'Available when online');
  }

  try {
    const config = await sendAppAction({ action: 'get_push_config' });
    if (config.enabled !== true || typeof config.publicKey !== 'string') {
      return state('unconfigured', 'Push delivery is not configured');
    }
  } catch {
    return state('available', 'Available when online');
  }

  return state(
    'available',
    Notification.permission === 'granted'
      ? 'Ready to enable'
      : 'Permission not requested'
  );
}

function applicationServerKey(value: string): Uint8Array {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binary = atob(base64);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function subscriptionPayload(subscription: PushSubscription) {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    p256dh: json.keys?.p256dh || '',
    auth: json.keys?.auth || '',
    expirationTime:
      subscription.expirationTime === null
        ? ''
        : String(subscription.expirationTime),
  };
}

export async function enablePushNotifications(
  userId: string
): Promise<PushNotificationState> {
  const unsupported = supportState();
  if (unsupported) return unsupported;
  if (!userId) return state('unsupported', 'Sign in to enable notifications');
  if (getConnectivitySnapshot().status !== 'online') {
    return state('available', 'Connect to the internet to enable');
  }

  const config = await sendAppAction({ action: 'get_push_config' });
  if (
    config.enabled !== true ||
    typeof config.publicKey !== 'string' ||
    !config.publicKey
  ) {
    return state('unconfigured', 'Push delivery is not configured');
  }

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    return state('blocked', 'Permission was not granted');
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey(config.publicKey),
    });
  }

  await sendAppAction({
    action: 'register_push_subscription',
    ...subscriptionPayload(subscription),
  });
  await setPushActiveUser(userId);
  return state('enabled', 'Enabled on this device', true);
}

export async function disablePushNotifications(
  userId: string
): Promise<PushNotificationState> {
  const unsupported = supportState();
  if (unsupported?.status === 'unsupported') return unsupported;

  const subscription = supportsWebPush()
    ? await getLocalSubscription()
    : null;
  if (subscription && getConnectivitySnapshot().status === 'online') {
    try {
      await sendAppAction({
        action: 'unregister_push_subscription',
        endpoint: subscription.endpoint,
      });
    } catch (error) {
      console.warn('[pushNotifications] server unsubscribe failed:', error);
    }
  }
  if (subscription) {
    await subscription.unsubscribe();
  }
  if (userId) await setPushActiveUser(userId);
  return getPushNotificationState();
}
