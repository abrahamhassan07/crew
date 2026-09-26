import React from "react";
import { Field } from "./Field";

interface Option {
  value: string;
  label: string;
}

interface SelectFieldProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label: string;
  options: Option[];
  error?: string;
  required?: boolean;
  help?: string;
  placeholder?: string;
}

export function SelectField({
  label,
  options,
  error,
  required,
  help,
  placeholder,
  className,
  ...props
}: SelectFieldProps) {
  return (
    <Field label={label} error={error} required={required} help={help} className={className}>
      <select
        className={`px-3 py-2 rounded-md border text-sm font-normal text-ink-primary bg-white focus:outline-none focus:ring-2 transition-all ${
          error
            ? "border-danger-red focus:border-danger-red focus:ring-danger-red/20"
            : "border-field-border focus:border-brand focus:ring-brand/20"
        }`}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
