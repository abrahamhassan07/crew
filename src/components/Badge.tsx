export function Badge({
  label,
  color,
  tint,
  strikethrough,
}: {
  label: string;
  color: string;
  tint: string;
  strikethrough?: boolean;
}) {
  return (
    <span
      className="inline-block px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap"
      style={{ background: tint, color, textDecoration: strikethrough ? "line-through" : "none" }}
    >
      {label}
    </span>
  );
}

export function StaffDot({ colorHex }: { colorHex: string }) {
  return <span className="inline-block w-[9px] h-[9px] rounded-full shrink-0" style={{ background: colorHex }} />;
}
