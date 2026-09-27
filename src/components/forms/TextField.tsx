import React from "react";
import { Field } from "./Field";

interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  label: string;
  error?: string;
  required?: boolean;
  help?: string;
  type?: "text" | "email" | "password" | "number" | "tel" | "url" | "date" | "time";
}

export function TextField({
  label,
  error,
  required,
  help,
  type = "text",
  className,
  ...props
}: TextFieldProps) {
  return (
    <Field label={label} error={error} required={required} help={help} className={className}>
      <input
        type={type}
        className={`px-3 py-2 rounded-md border text-sm font-normal text-ink-primary placeholder-ink-muted bg-white focus:outline-none focus:ring-2 transition-all ${
          error
            ? "border-danger-red focus:border-danger-red focus:ring-danger-red/20"
            : "border-field-border focus:border-brand focus:ring-brand/20"
        }`}
        {...props}
      />
    </Field>
  );
}
