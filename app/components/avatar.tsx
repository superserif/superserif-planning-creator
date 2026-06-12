import type { Person } from "@/lib/types";

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export default function Avatar({
  person,
  className = "size-6",
}: {
  person?: Person | null;
  className?: string;
}) {
  if (person?.avatar) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- tiny local assets, no optimization needed
      <img
        src={person.avatar}
        alt={person.name}
        draggable={false}
        className={`${className} shrink-0 rounded-full object-cover outline -outline-offset-1 outline-black/10 select-none`}
      />
    );
  }
  return (
    <span
      title={person?.name ?? "Non assigné"}
      className={`${className} flex shrink-0 items-center justify-center rounded-full bg-cloud text-[0.625rem] font-semibold text-ash outline -outline-offset-1 outline-black/5`}
    >
      {person ? initials(person.name) : "·"}
    </span>
  );
}
