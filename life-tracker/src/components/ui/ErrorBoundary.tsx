import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import { isChunkLoadError } from '../../lib/chunkLoadErrors';
import { captureHandledException } from '../../lib/posthog';

interface ErrorBoundaryProps {
  children: ReactNode;
  /**
   * Changing this value clears the boundary's error state. Use it to
   * reset on route change so navigating away from a broken route is
   * always a valid escape hatch. Pass `location.pathname`.
   */
  resetKey?: string;
  /**
   * When provided, the fallback renders a "Back" button wired to this
   * handler. Used by the per-route boundaries (routes into `/home`).
   */
  onBack?: () => void;
  /**
   * Label for the boundary, included in the log prefix so multi-boundary
   * stacks are distinguishable: `[ErrorBoundary:ChatPage]`. Defaults to
   * `root`.
   */
  label?: string;
  /** Offer an explicit full reload when Vite reports a failed lazy import. */
  reloadOnChunkError?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Class-based boundary. React has no hook equivalent for
 * `componentDidCatch` / `getDerivedStateFromError`; a class is required.
 *
 * The fallback matches the dark-theme retry card in `AppLayout` so a
 * crash looks native to the app rather than a white screen. No stack
 * trace in the UI; the error and the React component stack are logged
 * via `console.error` with the §10 `[ErrorBoundary]` prefix (React
 * itself logs in dev, so this is primarily the production surface).
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    const label = this.props.label || 'root';
    console.error(
      `[ErrorBoundary:${label}] Caught error:`,
      error,
      info.componentStack
    );
    captureHandledException(error, {
      boundary: label,
      componentStack: info.componentStack ?? '',
    });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    if (
      this.state.error !== null &&
      prevProps.resetKey !== this.props.resetKey
    ) {
      this.setState({ error: null });
    }
  }

  handleReset = (): void => {
    if (
      this.props.reloadOnChunkError &&
      this.state.error &&
      isChunkLoadError(this.state.error)
    ) {
      window.location.reload();
      return;
    }
    this.setState({ error: null });
  };

  render(): ReactNode {
    if (this.state.error === null) return this.props.children;
    const { onBack } = this.props;
    const needsReload =
      this.props.reloadOnChunkError && isChunkLoadError(this.state.error);
    return (
      <div className="min-h-screen bg-[#111111] flex items-center justify-center px-6">
        <div className="text-center max-w-sm w-full">
          <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333] mx-auto">
            <AlertTriangle size={28} className="text-gray-400" />
          </div>
          <h2 className="text-lg font-bold text-white mb-2">
            Something went wrong
          </h2>
          <p className="text-sm text-gray-500 mb-6 leading-relaxed">
            {needsReload
              ? 'This screen could not finish loading. Reloading may discard unfinished form input.'
              : 'This screen hit an unexpected error. Your data is safe.'}
          </p>
          <div className="flex flex-col gap-3">
            <button
              onClick={this.handleReset}
              className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl transition-colors"
            >
              {needsReload ? 'Reload app' : 'Try again'}
            </button>
            {onBack && (
              <button
                onClick={onBack}
                onPointerDown={(e) => e.stopPropagation()}
                className="bg-transparent text-gray-400 hover:text-white text-xs font-medium px-4 py-2 rounded-xl transition-colors"
              >
                Back to Home
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
