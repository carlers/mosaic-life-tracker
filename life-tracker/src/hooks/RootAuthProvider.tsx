import { lazy, Suspense, useSyncExternalStore, type ReactNode } from 'react';
import { CORE_BACKEND } from '../lib/coreBackendConfig';
import { AuthProvider } from './AuthProvider';
import { emailActionRevision, isEmailActionPath, subscribeEmailActionCallback } from '../lib/emailActionCallback';

const SupabaseAuthProvider = lazy(() => import('./SupabaseAuthProvider'));
const SupabaseEmailActionPage = lazy(() => import('./SupabaseEmailActionPage'));

export function RootAuthProvider({ children }: { children: ReactNode }) {
  const emailRevision = useSyncExternalStore(subscribeEmailActionCallback, emailActionRevision);
  if (CORE_BACKEND.driver === 'appwrite') return <AuthProvider>{children}</AuthProvider>;
  if (isEmailActionPath(window.location.pathname)) return <Suspense fallback={<div role="status">Opening email link</div>}>
    <SupabaseEmailActionPage key={emailRevision} config={CORE_BACKEND} />
  </Suspense>;
  return <Suspense fallback={<div role="status">Opening Mosaic</div>}>
    <SupabaseAuthProvider config={CORE_BACKEND}>{children}</SupabaseAuthProvider>
  </Suspense>;
}
