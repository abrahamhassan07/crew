import React from "react";

interface FieldProps {
  label: string;
  error?: string;
  required?: boolean;
  help?: string;
  children: React.ReactNode;
  className?: string;
}

export function Field({
  label,
  error,
  required,
  help,
  children,
  className = "",
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      <label className="text-sm font-semibold text-ink-secondary">
        {label}
        {required && <span className="text-danger-red ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-xs text-danger-red">{error}</p>}
      {help && !error && <p className="text-xs text-ink-muted">{help}</p>}
    </div>
  );
}
