import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

interface ScrollToBottomButtonProps {
  visible: boolean;
  hasNewMessages?: boolean;
  onClick: () => void;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  visible,
  hasNewMessages = false,
  onClick,
}) => {
  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.9 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          whileTap={{ scale: 0.92 }}
          onClick={onClick}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute bottom-24 right-4 z-20 w-10 h-10 rounded-full bg-[#2A2A2A] border border-[#444444] shadow-lg flex items-center justify-center text-gray-300 hover:text-white hover:bg-[#333333] transition-colors"
          aria-label="Scroll to bottom"
        >
          <ArrowDown size={18} />
          {hasNewMessages && (
            <span className="absolute top-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-[#111111]" />
          )}
        </motion.button>
      )}
    </AnimatePresence>
  );
};