import { lazy, Suspense, type ReactNode } from 'react';
import { CORE_BACKEND } from '../lib/coreBackendConfig';
import { AuthProvider } from './AuthProvider';

const SupabaseAuthProvider = lazy(() => import('./SupabaseAuthProvider'));

export function RootAuthProvider({ children }: { children: ReactNode }) {
  if (CORE_BACKEND.driver === 'appwrite') return <AuthProvider>{children}</AuthProvider>;
  return <Suspense fallback={<div role="status">Opening Mosaic</div>}>
    <SupabaseAuthProvider config={CORE_BACKEND}>{children}</SupabaseAuthProvider>
  </Suspense>;
}
