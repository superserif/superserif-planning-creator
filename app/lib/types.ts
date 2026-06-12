export type Status = "devise" | "demarre" | "termine" | "archive";

export interface Person {
  id: string;
  name: string;
  avatar?: string | null;
  /** Max simultaneous active projects over a period */
  capacity: number;
}

export interface Project {
  id: string;
  name: string;
  start_date: string; // ISO date YYYY-MM-DD, inclusive
  end_date: string; // ISO date YYYY-MM-DD, inclusive
  status: Status;
  person_id: string | null;
  /** Tag agence Moon-Moon */
  moonmoon?: boolean;
  /** Heures consommées / vendues — alimentées plus tard par l'API */
  hours_done?: number | null;
  hours_total?: number | null;
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
 * The lifecycle as a color narrative: not-started is only a dashed outline,
 * live work is solid ink (or Moon-Moon lime), finished work turns green,
 * archived work fades out.
 */
export const STATUSES: Record<Status, StatusSpec> = {
  devise: {
    label: "Non démarré",
    bar: "bg-black/4 text-ash outline-dashed -outline-offset-1 outline-1 outline-stone",
    dot: "bg-black/8 outline-dashed -outline-offset-1 outline-1 outline-stone",
    mini: "bg-stone/50",
    outsideText: "text-ash",
  },
  demarre: {
    label: "En cours",
    bar: "bg-ink text-white",
    dot: "bg-ink",
    mini: "bg-ink",
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

/** Moon-Moon swaps the "En cours" ink for the agency lime. */
export function barSpec(project: Project): StatusSpec {
  if (project.status === "demarre" && project.moonmoon) {
    return {
      ...STATUSES.demarre,
      bar: "bg-mmlime text-ink",
      dot: "bg-mmlime outline -outline-offset-1 outline-black/15",
      mini: "bg-mmlime outline -outline-offset-1 outline-black/10",
    };
  }
  return STATUSES[project.status];
}

export const STATUS_ORDER: Status[] = ["devise", "demarre", "termine", "archive"];
