import { useState, useEffect, useRef } from 'react';
import './SearchBar.css';

interface SearchBarProps {
  placeholder?: string;
  onSearch: (value: string) => void;
  debounceMs?: number;
  loading?: boolean;
  className?: string;
  defaultValue?: string;
  suggestions?: string[];
}

export function SearchBar({
  placeholder = 'Search...',
  onSearch,
  debounceMs = 300,
  loading = false,
  className = '',
  defaultValue = '',
  suggestions = [],
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const filteredSuggestions =
    value.trim().length > 0
      ? suggestions.filter((s) => s.toLowerCase().includes(value.toLowerCase()) && s !== value)
      : [];

  useEffect(() => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSearch(value);
    }, debounceMs);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [value, debounceMs, onSearch]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setShowSuggestions(true);
  };

  const handleClear = () => {
    setValue('');
    setShowSuggestions(false);
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
    onSearch(suggestion);
  };

  const searchBarClasses = ['search-bar', className].filter(Boolean).join(' ');

  return (
    <div className={searchBarClasses} ref={containerRef}>
      <div className="search-bar-icon" aria-hidden="true">
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M9 17A8 8 0 1 0 9 1a8 8 0 0 0 0 16zM19 19l-4.35-4.35"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <input
        type="search"
        className="search-bar-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        aria-label="Search"
        aria-autocomplete="list"
        aria-expanded={showSuggestions && filteredSuggestions.length > 0}
        aria-controls="search-suggestions"
        autoComplete="off"
      />

      {loading && (
        <div className="search-bar-loading" aria-label="Loading">
          <span className="search-bar-spinner" />
        </div>
      )}

      {!loading && value && (
        <button
          type="button"
          className="search-bar-clear"
          onClick={handleClear}
          aria-label="Clear search"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 4L4 12M4 4l8 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}

      {showSuggestions && filteredSuggestions.length > 0 && (
        <ul
          id="search-suggestions"
          className="search-bar-suggestions"
          role="listbox"
          aria-label="Search suggestions"
        >
          {filteredSuggestions.map((suggestion) => (
            <li
              key={suggestion}
              role="option"
              aria-selected={false}
              className="search-bar-suggestion-item"
              onMouseDown={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
