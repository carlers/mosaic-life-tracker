type Props = { onSkip: () => void; onStart: () => void };

// The optional first-run invitation is only needed for eligible new accounts.
// Keep its accessible markup intact while excluding it from Home's initial JS.
export default function TourInvite({ onSkip, onStart }: Props) {
  return (
    <aside className="fixed bottom-[max(env(safe-area-inset-bottom),1rem)] left-1/2 z-[70] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-xl border border-[#444] bg-[#1B1B1B] p-4 text-white shadow-xl" aria-label="Optional Mosaic tour">
      <h2 className="text-base font-semibold">New to Mosaic?</h2>
      <p className="mt-1 text-sm text-gray-300">See the essentials in a short, skippable tour.</p>
      <div className="mt-3 flex justify-end gap-3">
        <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={onSkip}>Not now</button>
        <button type="button" className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold" onClick={onStart}>Take a tour</button>
      </div>
    </aside>
  );
}
