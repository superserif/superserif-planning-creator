/** Tooltip ink — wraps an icon action; pure CSS, appears on hover/focus. */
export default function Tip({
  label,
  side = "bottom",
  children,
}: {
  label: string;
  side?: "bottom" | "left" | "top";
  children: React.ReactNode;
}) {
  const pos =
    side === "left"
      ? "right-full top-1/2 mr-1.5 -translate-y-1/2"
      : side === "top"
        ? "bottom-full left-1/2 mb-1.5 -translate-x-1/2"
        : "top-full left-1/2 mt-1.5 -translate-x-1/2";
  return (
    <span className="group/tip relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-50 hidden rounded-md bg-ink px-2 py-1 text-xs whitespace-nowrap text-white group-focus-within/tip:block group-hover/tip:block ${pos}`}
      >
        {label}
      </span>
    </span>
  );
}
