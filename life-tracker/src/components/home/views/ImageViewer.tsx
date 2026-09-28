import React, { useEffect, useRef } from 'react';
import PhotoSwipeLightbox from 'photoswipe/lightbox';
import 'photoswipe/style.css';

interface ImageViewerProps {
  isOpen: boolean;
  imageUrl: string | null;
  taskTitle?: string;
  taskDate?: string;
  onClose: () => void;
}

const IMAGE_VIEWER_HISTORY_KEY = '__mosaicImageViewerGuard';
let imageViewerHistorySequence = 0;

function readImageViewerGuard(state: unknown): string | null {
  if (typeof state !== 'object' || state === null || Array.isArray(state)) {
    return null;
  }
  const value = (state as Record<string, unknown>)[IMAGE_VIEWER_HISTORY_KEY];
  return typeof value === 'string' ? value : null;
}

function currentHistoryState(): Record<string, unknown> {
  if (
    typeof window.history.state === 'object' &&
    window.history.state !== null &&
    !Array.isArray(window.history.state)
  ) {
    return window.history.state as Record<string, unknown>;
  }
  return {};
}

function readIntrinsicDimensions(
  imageUrl: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();

    image.onload = () => {
      const width = image.naturalWidth || image.width;
      const height = image.naturalHeight || image.height;

      if (width > 0 && height > 0) {
        resolve({ width, height });
        return;
      }

      reject(new Error('Image has no intrinsic dimensions.'));
    };

    image.onerror = () => {
      reject(new Error('Could not read image dimensions.'));
    };

    image.src = imageUrl;
  });
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen,
  imageUrl,
  taskTitle,
  taskDate,
  onClose,
}) => {
  const lightboxRef = useRef<PhotoSwipeLightbox | null>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen || !imageUrl) {
      if (lightboxRef.current) {
        lightboxRef.current.destroy();
        lightboxRef.current = null;
      }
      return;
    }

    if (lightboxRef.current) {
      lightboxRef.current.destroy();
      lightboxRef.current = null;
    }

    let effectIsActive = true;
    let currentLightbox: PhotoSwipeLightbox | null = null;
    const historyId = `mosaic-image-viewer-${++imageViewerHistorySequence}`;

    window.history.pushState(
      {
        ...currentHistoryState(),
        [IMAGE_VIEWER_HISTORY_KEY]: historyId,
      },
      '',
      window.location.href
    );

    const requestClose = () => {
      if (!effectIsActive) return;

      if (readImageViewerGuard(window.history.state) === historyId) {
        window.history.back();
        return;
      }

      onCloseRef.current();
    };

    const handlePopState = (event: PopStateEvent) => {
      if (!effectIsActive) return;
      if (readImageViewerGuard(event.state) === historyId) return;
      onCloseRef.current();
    };

    window.addEventListener('popstate', handlePopState);

    const openViewer = async () => {
      let dimensions: { width: number; height: number };
      try {
        dimensions = await readIntrinsicDimensions(imageUrl);
      } catch {
        requestClose();
        return;
      }

      if (!effectIsActive) return;

      const lightbox = new PhotoSwipeLightbox({
        dataSource: [
          {
            src: imageUrl,
            w: dimensions.width,
            h: dimensions.height,
            alt: taskTitle || 'Task image',
          },
        ],
        pswpModule: () => import('photoswipe'),
        showHideAnimationType: 'zoom',
        bgOpacity: 1,
        closeOnVerticalDrag: true,
      });

      lightbox.on('uiRegister', () => {
        const pswp = lightbox.pswp;
        if (!pswp) return;

        const captionEl = document.createElement('div');
        captionEl.className = 'pswp__custom-caption';

        const inner = document.createElement('div');
        inner.style.padding = '20px';
        inner.style.background =
          'linear-gradient(to top, rgba(0,0,0,0.85), transparent)';
        inner.style.pointerEvents = 'none';

        if (taskTitle) {
          const titleEl = document.createElement('h3');
          titleEl.style.margin = '0 0 4px 0';
          titleEl.style.fontSize = '16px';
          titleEl.style.fontWeight = '600';
          titleEl.style.color = 'white';
          titleEl.textContent = taskTitle;
          inner.appendChild(titleEl);
        }

        if (taskDate) {
          const dateEl = document.createElement('p');
          dateEl.style.margin = '0';
          dateEl.style.fontSize = '12px';
          dateEl.style.color = '#a1a1aa';
          dateEl.textContent = `Added ${taskDate}`;
          inner.appendChild(dateEl);
        }

        captionEl.appendChild(inner);
        pswp.element?.appendChild(captionEl);
      });

      lightbox.on('close', requestClose);

      currentLightbox = lightbox;
      lightboxRef.current = lightbox;
      lightbox.init();
      lightbox.loadAndOpen(0);
    };

    void openViewer();

    return () => {
      effectIsActive = false;
      window.removeEventListener('popstate', handlePopState);
      currentLightbox?.destroy();
      if (lightboxRef.current === currentLightbox) {
        lightboxRef.current = null;
      }
    };
  }, [isOpen, imageUrl, taskTitle, taskDate]);

  return null;
};
