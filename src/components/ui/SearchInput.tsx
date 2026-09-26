import React, { useRef, useEffect } from "react";
import { Search } from "lucide-react";

interface SearchResult {
  id: string;
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  type?: string;
  onClick: () => void;
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  placeholder?: string;
  results?: SearchResult[];
  showResults?: boolean;
  isLoading?: boolean;
  className?: string;
}

export function SearchInput({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Search...",
  results = [],
  showResults = false,
  isLoading = false,
  className = "",
}: SearchInputProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onBlur?.();
      }
    };

    if (showResults) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showResults, onBlur]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-muted pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          className="w-full pl-10 pr-4 py-2 rounded-md border border-field-border bg-page-bg text-ink-primary placeholder-ink-muted focus:outline-none focus:border-brand focus:ring-2 focus:ring-brand/20 transition-all"
        />
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin w-4 h-4 border-2 border-brand border-t-transparent rounded-full" />
          </div>
        )}
      </div>

      {/* Results dropdown */}
      {showResults && (results.length > 0 || isLoading) && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-card-bg border border-line rounded-lg shadow-lg z-50 max-h-96 overflow-y-auto min-w-72">
          {isLoading ? (
            <div className="p-4 text-center text-ink-muted">Loading...</div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-ink-muted">No results</div>
          ) : (
            <div className="divide-y divide-line-soft">
              {results.map((result) => (
                <button
                  key={result.id}
                  onClick={() => {
                    result.onClick();
                    onBlur?.();
                  }}
                  className="w-full px-4 py-3 text-left hover:bg-page-bg transition-colors flex items-center gap-3"
                >
                  {result.icon && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-md bg-brand/10 text-brand flex items-center justify-center">
                      {result.icon}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-ink-primary truncate">{result.title}</div>
                    {result.subtitle && (
                      <div className="text-xs text-ink-muted truncate">{result.subtitle}</div>
                    )}
                  </div>
                  {result.type && (
                    <div className="text-xs font-semibold text-ink-muted uppercase tracking-wide">
                      {result.type}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
