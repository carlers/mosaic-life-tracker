import React, { useEffect, useRef } from 'react';
import { Search, X } from 'lucide-react';

interface ChatSearchBarProps {
  query: string;
  onChange: (q: string) => void;
  matchCount: number;
  totalCount: number;
  onClose: () => void;
}

export const ChatSearchBar: React.FC<ChatSearchBarProps> = ({
  query,
  onChange,
  matchCount,
  totalCount,
  onClose,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, []);

  const showCounter = query.trim().length > 0;

  return (
    <div className="flex-shrink-0 px-4 py-2 border-b border-[#333333] bg-[#111111] animate-in fade-in slide-in-from-top-1 duration-200">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
            <Search size={16} />
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Search messages…"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full bg-[#1E1E1E] text-white text-sm border border-[#333333] rounded-lg pl-9 pr-3 py-2 focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600"
          />
        </div>
        {showCounter && (
          <span className="text-xs text-gray-500 flex-shrink-0 tabular-nums">
            {matchCount}/{totalCount}
          </span>
        )}
        <button
          type="button"
          onClick={onClose}
          onPointerDown={(e) => e.stopPropagation()}
          className="flex-shrink-0 p-1.5 text-gray-500 hover:text-white transition-colors"
          aria-label="Close search"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
};