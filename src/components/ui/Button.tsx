import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    "font-medium rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeStyles = {
    sm: "px-3 py-2 text-sm",
    md: "px-4 py-2.5 text-sm",
    lg: "px-5 py-3 text-base",
  };

  const variantStyles = {
    primary:
      "bg-brand text-white hover:bg-brand-hover focus-visible:ring-brand/30",
    secondary:
      "bg-white border border-field-border text-ink-primary hover:bg-page-bg focus-visible:ring-brand/30",
    ghost: "text-brand hover:bg-brand/10 focus-visible:ring-brand/30",
    danger:
      "bg-danger-red text-white hover:opacity-90 focus-visible:ring-danger-red/30",
  };

  return (
    <button
      disabled={disabled || isLoading}
      className={`${baseStyles} ${sizeStyles[size]} ${variantStyles[variant]} ${className || ""}`}
      {...props}
    >
      {isLoading ? "Loading..." : children}
    </button>
  );
}
