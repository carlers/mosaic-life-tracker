import React from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
  placeholder?: string;
  disabled?: boolean;
}

export const SearchBar: React.FC<SearchBarProps> = ({
  value,
  onChange,
  onClear,
  placeholder = 'Search by username…',
  disabled = false,
}) => {
  return (
    <div className="relative">
      <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none">
        <Search size={18} />
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="w-full bg-[#1E1E1E] text-white border border-[#333333] rounded-xl pl-10 pr-10 py-3 text-sm focus:border-[#555555] focus:outline-none transition-colors placeholder-gray-600 disabled:opacity-50"
      />
      {value && (
        <button
          type="button"
          onClick={onClear}
          onPointerDown={(e) => e.stopPropagation()}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1 rounded-md"
          aria-label="Clear search"
        >
          <X size={16} />
        </button>
      )}
    </div>
  );
};