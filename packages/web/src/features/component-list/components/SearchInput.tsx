/**
 * Search Input Component
 * Text search for component name and description
 */

import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, X } from 'lucide-react';

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  debounceMs?: number;
}

export function SearchInput({
  value,
  onChange,
  placeholder,
  debounceMs = 300,
}: SearchInputProps) {
  const { t } = useTranslation('components');
  const resolvedPlaceholder = placeholder ?? t('list.searchPlaceholder');
  const [localValue, setLocalValue] = useState(value);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync with external value changes
  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  // Clear pending debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = (newValue: string) => {
    setLocalValue(newValue);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      onChange(newValue);
    }, debounceMs);
  };

  const handleClear = () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    setLocalValue('');
    onChange('');
  };

  return (
    <div className="space-y-2">
      <label htmlFor="search-input" className="block text-sm font-medium text-theme-secondary">
        {t('list.searchLabel')}
      </label>
      <div className="relative">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-theme-secondary"
          size={20}
          aria-hidden="true"
        />
        <input
          id="search-input"
          type="text"
          value={localValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={resolvedPlaceholder}
          data-testid="component-list-search-input"
          className="w-full h-12 pl-10 pr-10 rounded-lg input-theme"
          aria-label={t('list.searchInputAria')}
        />
        {localValue && (
          <button
            type="button"
            onClick={handleClear}
            data-testid="component-list-search-clear-button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-theme-secondary hover:text-theme-primary transition-colors"
            aria-label={t('list.searchClearAria')}
          >
            <X size={20} />
          </button>
        )}
      </div>
    </div>
  );
}
