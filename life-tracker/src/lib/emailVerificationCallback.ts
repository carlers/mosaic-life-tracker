/**
 * Retains email-verification parameters in memory only, with immediate URL
 * sanitization before startup telemetry or lazy route imports.
 */
export type EmailVerificationCallback = { userId: string; secret: string };
let captured: EmailVerificationCallback | null = null;

export function captureEmailVerificationCallbackUrl(): EmailVerificationCallback | null {
  if (typeof window === 'undefined' || window.location.pathname !== '/verify-email') {
    return captured;
  }
  const params = new URLSearchParams(window.location.search);
  if (params.has('userId') || params.has('secret')) {
    captured = {
      userId: params.get('userId')?.trim() ?? '',
      secret: params.get('secret')?.trim() ?? '',
    };
    window.history.replaceState(window.history.state, '', window.location.pathname);
  }
  return captured;
}

export function clearEmailVerificationCallback(): void {
  captured = null;
}
