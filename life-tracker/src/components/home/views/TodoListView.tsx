import React from 'react';
import { ListChecks } from 'lucide-react';

export const TodoListView: React.FC = () => {
  return (
    <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6 animate-in fade-in duration-300">
      <div className="w-16 h-16 bg-[#1E1E1E] rounded-full flex items-center justify-center mb-4 border border-[#333333]">
        <ListChecks size={32} className="text-gray-400" />
      </div>
      <h2 className="text-xl font-bold text-white mb-2">Todo List View</h2>
      <p className="text-gray-500 text-sm max-w-xs">
        Compact color grid and vertical task list coming in Batch 4.
      </p>
    </div>
  );
};