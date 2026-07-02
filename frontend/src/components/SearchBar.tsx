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
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const debounceTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setShowSuggestions(true);
    setActiveSuggestionIndex(-1);
  };

  const handleClear = () => {
    setValue('');
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    inputRef.current?.focus();
  };

  const handleSuggestionClick = (suggestion: string) => {
    setValue(suggestion);
    setShowSuggestions(false);
    setActiveSuggestionIndex(-1);
    onSearch(suggestion);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || filteredSuggestions.length === 0) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev < filteredSuggestions.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveSuggestionIndex((prev) =>
          prev > 0 ? prev - 1 : filteredSuggestions.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (activeSuggestionIndex >= 0 && activeSuggestionIndex < filteredSuggestions.length) {
          handleSuggestionClick(filteredSuggestions[activeSuggestionIndex]);
        }
        break;
      case 'Escape':
        setShowSuggestions(false);
        setActiveSuggestionIndex(-1);
        break;
    }
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
        ref={inputRef}
        type="search"
        className="search-bar-input"
        placeholder={placeholder}
        value={value}
        onChange={handleChange}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={handleKeyDown}
        aria-label="Search"
        aria-autocomplete="list"
        aria-expanded={showSuggestions && filteredSuggestions.length > 0}
        aria-controls="search-suggestions"
        aria-activedescendant={
          activeSuggestionIndex >= 0
            ? `search-suggestion-${activeSuggestionIndex}`
            : undefined
        }
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
          {filteredSuggestions.map((suggestion, index) => (
            <li
              key={suggestion}
              id={`search-suggestion-${index}`}
              role="option"
              aria-selected={index === activeSuggestionIndex}
              className={`search-bar-suggestion-item ${
                index === activeSuggestionIndex ? 'search-bar-suggestion-item--active' : ''
              }`}
              onMouseDown={() => handleSuggestionClick(suggestion)}
              onMouseEnter={() => setActiveSuggestionIndex(index)}
            >
              {suggestion}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
