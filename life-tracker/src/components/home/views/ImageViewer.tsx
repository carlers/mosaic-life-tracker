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
  
  // Keep the ref updated so the close event always calls the latest onClose
  onCloseRef.current = onClose;

  useEffect(() => {
    // 1. If closed or no image yet, destroy any existing lightbox
    if (!isOpen || !imageUrl) {
      if (lightboxRef.current) {
        lightboxRef.current.destroy();
        lightboxRef.current = null;
      }
      return;
    }

    // 2. Destroy previous instance if re-opening or image changed
    if (lightboxRef.current) {
      lightboxRef.current.destroy();
    }

    // 3. Initialize and OPEN immediately
    const lightbox = new PhotoSwipeLightbox({
      dataSource: [{
        src: imageUrl,
        w: 1920, h: 1080, // Fallback dimensions for initial zoom animation
        alt: taskTitle || 'Task image'
      }],
      pswpModule: () => import('photoswipe'),
      showHideAnimationType: 'zoom',
      bgOpacity: 1,
      closeOnVerticalDrag: true,
    });
    
    // 4. Inject custom caption via uiRegister event
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
      
      // Append to root so it sits above the image but below the default UI buttons
      pswp.element?.appendChild(captionEl);
    });

    lightbox.init();
    lightbox.loadAndOpen(0); // <-- CRITICAL: Opens the viewer immediately
    lightboxRef.current = lightbox;

    // 5. Sync React state when user swipes down or taps close
    lightbox.on('close', () => {
      onCloseRef.current();
    });

    return () => {
      lightbox.destroy();
      lightboxRef.current = null;
    };
  }, [isOpen, imageUrl]); // Re-runs safely whenever either state changes

  return null; // PhotoSwipe renders its own DOM directly into body
};