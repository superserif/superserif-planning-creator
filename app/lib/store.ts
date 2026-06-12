import type { SupabaseClient } from "@supabase/supabase-js";
import type { Person, Project } from "./types";
import { getSupabase } from "./supabase-client";
import { shiftIso, todayIso } from "./dates";

export interface StoreData {
  projects: Project[];
  people: Person[];
}

export interface Store {
  mode: "supabase" | "local";
  load(): Promise<StoreData>;
  upsertProject(p: Project): Promise<void>;
  deleteProject(id: string): Promise<void>;
  addPerson(p: Person): Promise<void>;
  updatePerson(p: Person): Promise<void>;
  deletePerson(id: string): Promise<void>;
  /** Called when data changed remotely (another tab or another client). */
  subscribe(onChange: () => void): () => void;
}

const LS_KEY = "lineup-data-v2";

function seed(): StoreData {
  const t = todayIso();
  const people: Person[] = [
    { id: crypto.randomUUID(), name: "JJ", avatar: "/portrait-jj.png", capacity: 4 },
    { id: crypto.randomUUID(), name: "Sylvain", avatar: "/portrait-sylvain.png", capacity: 3 },
    { id: crypto.randomUUID(), name: "Kiks", avatar: "/portrait-killian.png", capacity: 4 },
  ];
  const [jj, sylvain, kiks] = people;
  const projects: Project[] = [
    {
      id: crypto.randomUUID(),
      name: "Identité — Café Lumen",
      start_date: shiftIso(t, -120),
      end_date: shiftIso(t, -75),
      status: "termine",
      person_id: jj.id,
    },
    {
      id: crypto.randomUUID(),
      name: "Site e-commerce — Atelier Sud",
      start_date: shiftIso(t, -60),
      end_date: shiftIso(t, 10),
      status: "demarre",
      person_id: sylvain.id,
    },
    {
      id: crypto.randomUUID(),
      name: "Motion — Festival 2026",
      start_date: shiftIso(t, -15),
      end_date: shiftIso(t, 30),
      status: "demarre",
      person_id: kiks.id,
    },
    {
      id: crypto.randomUUID(),
      name: "Guidelines — Studio K",
      start_date: shiftIso(t, 20),
      end_date: shiftIso(t, 55),
      status: "devise",
      person_id: jj.id,
    },
    {
      id: crypto.randomUUID(),
      name: "Packaging — Maison Verte",
      start_date: shiftIso(t, 45),
      end_date: shiftIso(t, 90),
      status: "devise",
      person_id: sylvain.id,
    },
    {
      id: crypto.randomUUID(),
      name: "Refonte — La Galerie",
      start_date: shiftIso(t, -150),
      end_date: shiftIso(t, -110),
      status: "archive",
      person_id: kiks.id,
    },
  ];
  return { projects, people };
}

function createLocalStore(): Store {
  const read = (): StoreData => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const data = JSON.parse(raw) as StoreData;
        // normalize data written by older versions
        data.people = data.people.map((p) => ({ ...p, capacity: p.capacity ?? 3 }));
        data.projects = data.projects.map((p) =>
          (p.status as string) === "a_demarrer" ? { ...p, status: "devise" } : p,
        );
        return data;
      }
    } catch {
      // corrupted storage falls through to reseed
    }
    const data = seed();
    localStorage.setItem(LS_KEY, JSON.stringify(data));
    return data;
  };
  const write = (data: StoreData) => {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  };

  return {
    mode: "local",
    async load() {
      return read();
    },
    async upsertProject(p) {
      const data = read();
      const i = data.projects.findIndex((x) => x.id === p.id);
      if (i >= 0) data.projects[i] = p;
      else data.projects.push(p);
      write(data);
    },
    async deleteProject(id) {
      const data = read();
      data.projects = data.projects.filter((x) => x.id !== id);
      write(data);
    },
    async addPerson(p) {
      const data = read();
      data.people.push(p);
      write(data);
    },
    async updatePerson(p) {
      const data = read();
      data.people = data.people.map((x) => (x.id === p.id ? p : x));
      write(data);
    },
    async deletePerson(id) {
      const data = read();
      data.people = data.people.filter((x) => x.id !== id);
      data.projects = data.projects.map((x) =>
        x.person_id === id ? { ...x, person_id: null } : x,
      );
      write(data);
    },
    subscribe(onChange) {
      const handler = (e: StorageEvent) => {
        if (e.key === LS_KEY) onChange();
      };
      window.addEventListener("storage", handler);
      return () => window.removeEventListener("storage", handler);
    },
  };
}

function createSupabaseStore(client: SupabaseClient): Store {
  return {
    mode: "supabase",
    async load() {
      const [projects, people] = await Promise.all([
        client
          .from("projects")
          .select(
            "id,name,start_date,end_date,status,person_id,moonmoon,hours_done,hours_total",
          ),
        client.from("people").select("id,name,avatar,capacity").order("name"),
      ]);
      if (projects.error) throw projects.error;
      if (people.error) throw people.error;
      return {
        projects: (projects.data ?? []) as Project[],
        people: (people.data ?? []) as Person[],
      };
    },
    async upsertProject(p) {
      const { error } = await client.from("projects").upsert(p);
      if (error) throw error;
    },
    async deleteProject(id) {
      const { error } = await client.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    async addPerson(p) {
      const { error } = await client.from("people").insert(p);
      if (error) throw error;
    },
    async updatePerson(p) {
      const { error } = await client.from("people").upsert(p);
      if (error) throw error;
    },
    async deletePerson(id) {
      const { error } = await client.from("people").delete().eq("id", id);
      if (error) throw error;
    },
    subscribe(onChange) {
      const channel = client
        .channel("lineup-realtime")
        .on("postgres_changes", { event: "*", schema: "public", table: "projects" }, onChange)
        .on("postgres_changes", { event: "*", schema: "public", table: "people" }, onChange)
        .subscribe();
      return () => {
        client.removeChannel(channel);
      };
    },
  };
}

export function createStore(): Store {
  const client = getSupabase();
  if (client) return createSupabaseStore(client);
  return createLocalStore();
}
