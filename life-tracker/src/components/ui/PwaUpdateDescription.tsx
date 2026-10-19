import { APP_VERSION } from '../../lib/appVersion';
import { describePwaUpdate, type PwaUpdateInfo } from '../../lib/pwaUpdateInfo';

export function PwaUpdateDescription({ info }: { info: PwaUpdateInfo | null }) {
  const details = describePwaUpdate(APP_VERSION, info);
  return (
    <div className="min-w-0">
      <div className="flex flex-wrap items-center gap-2 text-xs font-medium text-gray-400">
        <span>{details.label}</span>
        {details.version && <span>v{details.version}</span>}
      </div>
      <h2 className="mt-1 font-semibold text-white">{details.title}</h2>
      <p className="mt-1 text-sm leading-5 text-gray-400">{details.description}</p>
      {details.changes.length > 0 && (
        <details className="mt-2 text-sm text-gray-300">
          <summary className="w-fit cursor-pointer rounded-sm text-sm font-medium text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            See what's changed
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-4" aria-label="Selected update highlights">
            {details.changes.map((change, index) => <li key={index}>{change}</li>)}
          </ul>
        </details>
      )}
    </div>
  );
}
