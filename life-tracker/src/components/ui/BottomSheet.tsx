import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence, useDragControls } from 'framer-motion';
import ReactDOM from 'react-dom'; // <-- ADD THIS

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  height?: 'auto' | 'full'; 
}

export const BottomSheet: React.FC<BottomSheetProps> = ({ 
  isOpen, 
  onClose, 
  children, 
  title,
  height = 'auto' 
}) => {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragControls = useDragControls();

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [isOpen, onClose]);

  const heightClass = height === 'full' ? 'h-[100dvh] rounded-none' : 'max-h-[90vh] rounded-t-3xl';

  // FIX: Render content via Portal to document.body to escape all z-index/overflow traps
  const sheetContent = (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-[50] bg-black/60 backdrop-blur-sm"
          />

          <motion.div
            ref={sheetRef}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            drag="y"
            dragControls={dragControls}
            dragListener={false}
            dragConstraints={{ top: 0 }}
            dragElastic={0.1}
            onDragEnd={(_, info) => {
              if (info.offset.y > 100 || info.velocity.y > 500) onClose();
            }}
            className={`fixed bottom-0 left-0 right-0 z-[60] bg-[#1E1E1E] text-white shadow-2xl flex flex-col ${heightClass}`}
          >
            <div 
              className="flex-shrink-0 pt-3 pb-2 px-4 flex flex-col items-center cursor-grab active:cursor-grabbing touch-none"
              onPointerDown={(e) => dragControls.start(e)}
            >
              <div className="w-10 h-1.5 bg-[#444444] rounded-full mb-3" />
              {title && <h3 className="text-lg font-semibold w-full text-center">{title}</h3>}
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-8 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return ReactDOM.createPortal(sheetContent, document.body);
};