import React from 'react';
import { BookOpen } from 'lucide-react';

export const DiaryView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]">
        <BookOpen size={32} className="text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Diary View</h2>
      <p className="text-gray-500 text-sm max-w-xs">
        Daily journal editor coming in Batch 5.
      </p>
    </div>
  );
};