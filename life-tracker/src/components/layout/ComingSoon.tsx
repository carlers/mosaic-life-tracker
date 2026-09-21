import React from 'react';
import { Construction } from 'lucide-react';

export const ComingSoon: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center p-6">
      <div
        className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]"
        aria-hidden="true"
      >
        <Construction size={32} className="text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Coming Soon</h2>
      <p className="text-gray-400 text-sm max-w-xs leading-relaxed">
        This feature is currently under construction. Check back in Phase 2!
      </p>
    </div>
  );
};
