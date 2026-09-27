interface FilterTabOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface FilterTabsProps<T extends string> {
  options: FilterTabOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

/**
 * Pill-style status filter bar shared by Clients, Services, Requests,
 * Quotes and Invoices (e.g. All / Draft / Sent / Approved).
 */
export function FilterTabs<T extends string>({ options, value, onChange, className = "" }: FilterTabsProps<T>) {
  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`h-9 px-3.5 rounded-full text-sm font-semibold border flex items-center gap-1.5 transition-colors ${
              active
                ? "bg-forest text-white border-forest"
                : "bg-card-bg text-ink-primary border-field-border hover:bg-page-bg"
            }`}
          >
            {opt.label}
            {opt.count != null && <span className="opacity-70 text-xs">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
