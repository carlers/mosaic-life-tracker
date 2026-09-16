import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, X } from 'lucide-react';

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Reset dismissal when back online so it's ready to show next time we go offline
      setIsDismissed(false);
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const handleDismiss = () => {
    setIsDismissed(true);
  };

  // Only show if we are offline AND the user hasn't dismissed it for this session
  const visible = !isOnline && !isDismissed;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          role="status"
          aria-live="polite"
          className="fixed top-0 left-0 right-0 z-50 bg-[#1E1E1E] border-b border-[#333333] px-4 py-2 flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-2">
            <WifiOff size={14} className="text-gray-400" aria-hidden="true" />
            <span className="text-xs text-gray-400">
              You are offline. Changes will sync later.
            </span>
          </div>
          <button
            type="button"
            onClick={handleDismiss}
            className="text-gray-500 hover:text-gray-300 transition-colors p-1 rounded-md hover:bg-[#333333] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/60"
            aria-label="Dismiss offline banner"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
