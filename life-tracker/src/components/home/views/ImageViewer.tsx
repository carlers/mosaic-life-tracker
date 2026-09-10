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
        w: 1920, h: 1080,
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
      captionEl.innerHTML = `
        <div style="padding: 20px; background: linear-gradient(to top, rgba(0,0,0,0.85), transparent); pointer-events: none;">
          ${taskTitle ? `<h3 style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: white;">${taskTitle}</h3>` : ''}
          ${taskDate ? `<p style="margin: 0; font-size: 12px; color: #a1a1aa;">Added ${taskDate}</p>` : ''}
        </div>
      `;
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