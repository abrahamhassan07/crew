"use client";

import { useState } from "react";

const parse = (text: string) => (text === "" || text === "." ? 0 : Number(text));

/**
 * A plain text box for a number (quantity or price) with no up/down spinner. Typing is free-form ("12.", ".5"),
 * only digits and one decimal point are accepted, and the number is reported as you type. A price is shown to
 * two decimals once you leave the box.
 */
export function DecimalInput({
  value,
  onValue,
  prefix,
  decimals = 2,
  padOnBlur = false,
  disabled,
  label,
  className = "",
}: {
  value: number;
  onValue: (n: number) => void;
  prefix?: string;
  decimals?: number;
  padOnBlur?: boolean;
  disabled?: boolean;
  label: string;
  className?: string;
}) {
  const format = (n: number) => (padOnBlur ? n.toFixed(decimals) : String(n));
  const [text, setText] = useState(format(value));
  // If the number is changed from outside (not by typing here), show it instead of the stale text.
  const shown = parse(text) === value ? text : format(value);

  const change = (raw: string) => {
    const clean = raw.replace(/[^\d.]/g, "");
    const [whole, ...rest] = clean.split(".");
    const next = rest.length ? `${whole}.${rest.join("").slice(0, decimals)}` : whole;
    setText(next);
    onValue(parse(next));
  };

  return (
    <div className="relative">
      {prefix && <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted pointer-events-none">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        autoComplete="off"
        aria-label={label}
        disabled={disabled}
        value={shown}
        onChange={(e) => change(e.target.value)}
        onBlur={() => padOnBlur && setText(format(value))}
        className={`h-9 w-full border border-field-border rounded-md text-sm bg-white disabled:bg-neutral-bg ${prefix ? "pl-5 pr-2" : "px-2.5"} ${className}`}
      />
    </div>
  );
}
