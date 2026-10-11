import { ImageOff } from 'lucide-react';
import type { TaskDocument } from '../db/schema';
import { useImageLoadGate } from '../hooks/useImageLoadGate';
import { useTaskImage } from '../hooks/useTaskImage';

/** Read-only link preview. The normal task owns its image and storage lifecycle. */
export function LinkedTaskPhoto({ task, onView }: {
  task: TaskDocument;
  onView: (task: TaskDocument) => void;
}) {
  const { targetRef, shouldLoad } = useImageLoadGate<HTMLDivElement>();
  const { imageUrl, isLoading } = useTaskImage(task.image, shouldLoad);

  if (!task.image) return null;

  return <div ref={targetRef} className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-surfaceHighlight">
    {imageUrl ? (
      <button
        type="button"
        aria-label={`View photo for ${task.title}`}
        onClick={() => onView(task)}
        className="h-full w-full focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-current"
      >
        <img src={imageUrl} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
      </button>
    ) : (
      <div
        role={shouldLoad && !isLoading ? 'status' : undefined}
        aria-label={shouldLoad && !isLoading ? `Photo unavailable for ${task.title}` : undefined}
        aria-hidden={!shouldLoad || isLoading}
        className={`flex h-full w-full items-center justify-center text-muted-foreground ${isLoading ? 'motion-safe:animate-pulse' : ''}`}
      >
        {shouldLoad && !isLoading && <ImageOff size={20} aria-hidden="true" />}
      </div>
    )}
  </div>;
}
