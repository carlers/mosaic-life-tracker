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

export const ImageViewer: React.FC<ImageViewerProps> = ({
  isOpen, imageUrl, taskTitle, taskDate, onClose
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
    }

    let effectIsActive = true;

    const lightbox = new PhotoSwipeLightbox({
      dataSource: [{
        src: imageUrl,
        w: 1920,
        h: 1080,
        alt: taskTitle || 'Task image'
      }],
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
      inner.style.background = 'linear-gradient(to top, rgba(0,0,0,0.85), transparent)';
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

    lightbox.on('close', () => {
      if (effectIsActive) {
        onCloseRef.current();
      }
    });

    lightbox.init();
    lightbox.loadAndOpen(0);
    lightboxRef.current = lightbox;

    return () => {
      effectIsActive = false;
      lightbox.destroy();
      lightboxRef.current = null;
    };
  }, [isOpen, imageUrl, taskTitle, taskDate]);

  return null;
};