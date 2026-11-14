import type { ReactNode } from 'react';
import { Info } from 'lucide-react';

/** Native disclosure: hover on desktop; tap/Enter/Space toggle on touch/keyboard. */
export function CommandInfo({ label, children }: { label: string; children: ReactNode }) {
  return <details className="group relative inline-flex shrink-0 align-middle">
    <summary aria-label={`About ${label}`} title={`About ${label}`}
      className="flex h-7 w-7 list-none cursor-help items-center justify-center rounded-full text-gray-400 outline-none hover:bg-surfaceHighlight hover:text-white focus-visible:ring-2 focus-visible:ring-accent [&::-webkit-details-marker]:hidden">
      <Info size={16} aria-hidden="true" />
    </summary>
    <div role="note" className="absolute right-0 top-8 z-50 hidden w-64 max-w-[75vw] rounded-xl border border-border bg-surface p-3 text-xs leading-relaxed text-gray-300 shadow-xl group-hover:block group-open:block">
      {children}
    </div>
  </details>;
}
