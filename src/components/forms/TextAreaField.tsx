import React from "react";
import { Field } from "./Field";

interface TextAreaFieldProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "type"> {
  label: string;
  error?: string;
  required?: boolean;
  help?: string;
}

export function TextAreaField({
  label,
  error,
  required,
  help,
  className,
  rows = 4,
  ...props
}: TextAreaFieldProps) {
  return (
    <Field label={label} error={error} required={required} help={help} className={className}>
      <textarea
        rows={rows}
        className={`px-3 py-2 rounded-md border text-sm font-normal text-ink-primary placeholder-ink-muted bg-white focus:outline-none focus:ring-2 transition-all resize-vertical ${
          error
            ? "border-danger-red focus:border-danger-red focus:ring-danger-red/20"
            : "border-field-border focus:border-brand focus:ring-brand/20"
        }`}
        {...props}
      />
    </Field>
  );
}
