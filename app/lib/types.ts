export type Status =
  | "devise"
  | "a_demarrer"
  | "demarre"
  | "termine"
  | "archive";

export interface Person {
  id: string;
  name: string;
  avatar?: string | null;
}

export interface Project {
  id: string;
  name: string;
  start_date: string; // ISO date YYYY-MM-DD, inclusive
  end_date: string; // ISO date YYYY-MM-DD, inclusive
  status: Status;
  person_id: string | null;
}

export interface StatusSpec {
  label: string;
  /** Classes applied to the gantt bar */
  bar: string;
  /** Classes applied to the small status dot */
  dot: string;
  /** Classes applied to the miniature bar shown in a collapsed group */
  mini: string;
  /** Label color when the name is rendered outside a short bar */
  outsideText: string;
}

/**
 * The lifecycle as a color narrative: a quote is only an outline,
 * committed work turns pale blue, live work carries the single accent,
 * finished work turns green, archived work fades out.
 */
export const STATUSES: Record<Status, StatusSpec> = {
  devise: {
    label: "Devisé",
    bar: "bg-white text-ink outline -outline-offset-1 outline-hairline",
    dot: "bg-white outline -outline-offset-1 outline-stone",
    mini: "bg-white outline -outline-offset-1 outline-stone",
    outsideText: "text-ash",
  },
  a_demarrer: {
    label: "À démarrer",
    bar: "bg-sky/12 text-sky-deep outline -outline-offset-1 outline-sky/25",
    dot: "bg-sky/20 outline -outline-offset-1 outline-sky/50",
    mini: "bg-sky/50",
    outsideText: "text-ash",
  },
  demarre: {
    label: "Démarré",
    bar: "bg-rausch text-white",
    dot: "bg-rausch",
    mini: "bg-rausch",
    outsideText: "text-ink",
  },
  termine: {
    label: "Terminé",
    bar: "bg-leaf text-white",
    dot: "bg-leaf",
    mini: "bg-leaf",
    outsideText: "text-ash",
  },
  archive: {
    label: "Archivé",
    bar: "bg-mute/30 text-ash",
    dot: "bg-mute/50",
    mini: "bg-mute/40",
    outsideText: "text-mute",
  },
};

export const STATUS_ORDER: Status[] = [
  "devise",
  "a_demarrer",
  "demarre",
  "termine",
  "archive",
];
