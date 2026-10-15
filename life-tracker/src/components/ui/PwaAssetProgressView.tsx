import type { PwaAssetProgress } from '../../lib/pwaLifecycle';

export function PwaAssetProgressView({ progress }: { progress: PwaAssetProgress }) {
  const bytesKnown = progress.totalBytes !== null && progress.totalBytes > 0 &&
    progress.completedBytes !== null;
  const measured = bytesKnown
    ? (progress.completedBytes! / progress.totalBytes!) * 100
    : (progress.completed / progress.total) * 100;
  // Even 99.9% must not round to 100% before the phase is complete.
  const isComplete = progress.completed === progress.total &&
    (!bytesKnown || progress.completedBytes === progress.totalBytes);
  const percent = isComplete ? 100 : Math.min(99, Math.round(measured));
  const phaseLabel = isComplete ? 'App files prepared' : 'Preparing app files';
  // KB is decimal (1000 bytes). These are uncompressed build file sizes,
  // never a claim about transferred network bytes.
  const size = bytesKnown
    ? `${Math.round(progress.completedBytes! / 1000)}/${Math.round(progress.totalBytes! / 1000)} KB`
    : `${progress.completed}/${progress.total} files`;

  return (
    <div className="mt-2" data-testid="pwa-asset-progress">
      <div className="flex items-center justify-between gap-2 text-xs text-gray-400">
        <span>{phaseLabel}</span>
        <span className="tabular-nums">{size} · {percent}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={phaseLabel}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-gray-700"
      >
        <div
          className="h-full rounded-full bg-emerald-500 transition-[width] motion-reduce:transition-none"
          style={{ width: `${percent}%` }}
        />
      </div>
      {bytesKnown && (
        <span className="sr-only">Sizes represent uncompressed app files, not network transfer.</span>
      )}
    </div>
  );
}
