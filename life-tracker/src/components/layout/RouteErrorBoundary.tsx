import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ErrorBoundary } from '../ui/ErrorBoundary';

interface RouteErrorBoundaryProps {
  children: React.ReactNode;
  /**
   * Label for the boundary, included in the `[ErrorBoundary:<label>]`
   * log prefix. Should name the route (e.g. `ChatPage`).
   */
  label: string;
}

/**
 * Per-route boundary. Two jobs beyond the primitive:
 *
 *  1. Reset on navigation. `<ErrorBoundary resetKey={location.pathname}>`
 *     clears a prior error when the path changes, so leaving a broken
 *     route is always possible — the fallback's "Back to Home" and the
 *     bottom nav both navigate, and the navigation itself is the reset.
 *
 *  2. Back button. Routes into `/home`, which is always safe to render
 *     (own pane, RxDB-backed) even if a friend pane is broken.
 *
 * The boundary is placed *inside* `MainLayout`'s scroll container (via
 * `AppLayout`'s `Outlet`), so the bottom nav and offline banner survive
 * a route crash and the user can navigate away.
 */
export const RouteErrorBoundary: React.FC<RouteErrorBoundaryProps> = ({
  children,
  label,
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const handleBack = React.useCallback(() => {
    navigate('/home', { replace: true });
  }, [navigate]);
  return (
    <ErrorBoundary
      resetKey={location.pathname}
      onBack={handleBack}
      label={label}
    >
      {children}
    </ErrorBoundary>
  );
};
