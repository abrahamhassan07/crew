import React, { useEffect } from "react";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeStyles = {
  sm: "w-96",
  md: "w-[560px]",
  lg: "w-2xl",
};

export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  footer,
  size = "md",
  className = "",
}: DialogProps) {
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }
    return () => {
      document.body.style.overflow = "auto";
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div
        className={`relative bg-card-bg rounded-xl shadow-xl max-h-[90vh] overflow-y-auto max-w-full ${sizeStyles[size]} ${className}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-line-soft">
          <h2 className="text-lg font-bold text-ink-primary">{title}</h2>
          <button
            onClick={() => onOpenChange(false)}
            className="text-ink-muted hover:text-ink-primary rounded-md transition-colors"
            aria-label="Close dialog"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">{children}</div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-4 border-t border-line-soft bg-page-bg">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
