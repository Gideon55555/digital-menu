'use client';

import { Search, X } from 'lucide-react';
import { useState, useCallback } from 'react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
}

export function SearchBar({
  onSearch,
  placeholder = 'Search menu items...',
}: SearchBarProps) {
  const [query, setQuery] = useState('');

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setQuery(value);
      onSearch(value);
    },
    [onSearch]
  );

  const handleClear = () => {
    setQuery('');
    onSearch('');
  };

  return (
    <div className="relative w-full">
      <div className="relative flex items-center">
        <Search
          className="absolute left-3 text-restaurant-text-light dark:text-gray-400"
          size={20}
        />
        <input
          type="text"
          value={query}
          onChange={handleChange}
          placeholder={placeholder}
          className="w-full pl-10 pr-10 py-2.5 border border-cream-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-restaurant-text dark:text-white rounded-lg focus:ring-2 focus:ring-restaurant-accent/50 focus:border-transparent transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 p-1 hover:bg-cream-100 dark:hover:bg-slate-700 rounded transition-colors"
            aria-label="Clear search"
          >
            <X size={18} className="text-restaurant-text-light" />
          </button>
        )}
      </div>
    </div>
  );
}
