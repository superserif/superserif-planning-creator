"use client";

export default function AppHeader({
  centerLabel,
  onPrevMonth,
  onNextMonth,
  onToday,
  onAddProject,
  onLogout,
}: {
  centerLabel: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onAddProject: () => void;
  onLogout?: () => void;
}) {
  return (
    <header className="flex shrink-0 items-center justify-between gap-4 border-b border-black/8 px-4 py-3 sm:px-6">
      <div className="flex flex-1 items-center">
        <h1 className="text-lg font-semibold tracking-tight text-balance">
          Lineup<span className="text-rausch">.</span>
        </h1>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onPrevMonth}
          aria-label="Mois précédent"
          className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-ash transition-transform outline -outline-offset-1 outline-hairline hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
          />
          <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
            <path
              d="M10 3.5 5.5 8 10 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <p className="w-32 text-center text-sm font-semibold tracking-tight whitespace-nowrap tabular-nums">
          {centerLabel}
        </p>
        <button
          type="button"
          onClick={onNextMonth}
          aria-label="Mois suivant"
          className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-ash transition-transform outline -outline-offset-1 outline-hairline hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-ink"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
          />
          <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
            <path
              d="M6 3.5 10.5 8 6 12.5"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={onToday}
          className="ml-1 rounded-full px-3 py-1.5 text-sm text-ash outline -outline-offset-1 outline-hairline hover:bg-cloud hover:text-ink focus-visible:outline-2 focus-visible:outline-ink max-sm:hidden"
        >
          Aujourd&rsquo;hui
        </button>
      </div>

      <div className="flex flex-1 items-center justify-end gap-2">
        {onLogout && (
          <button
            type="button"
            onClick={onLogout}
            aria-label="Se déconnecter"
            title="Se déconnecter"
            className="relative flex size-8 shrink-0 items-center justify-center rounded-full text-ash transition-transform outline -outline-offset-1 outline-hairline hover:text-ink active:scale-95 focus-visible:outline-2 focus-visible:outline-ink"
          >
            <span
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-1/2 size-[max(100%,3rem)] -translate-1/2 pointer-fine:hidden"
            />
            <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
              <path
                d="M6 13.5H3.5a1 1 0 0 1-1-1v-9a1 1 0 0 1 1-1H6M10.5 11l3-3-3-3M13 8H6.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
        <button
          type="button"
          onClick={onAddProject}
          title="Nouveau projet (⌘P)"
          className="flex items-center gap-1.5 rounded-lg bg-rausch py-2 pr-3 pl-2 text-sm font-semibold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rausch"
        >
          <svg viewBox="0 0 16 16" fill="none" className="size-4 shrink-0">
            <path
              d="M8 3.5v9M3.5 8h9"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          <span className="max-sm:hidden">Ajouter un projet</span>
          <span className="sm:hidden">Projet</span>
        </button>
      </div>
    </header>
  );
}
