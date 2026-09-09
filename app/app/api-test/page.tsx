"use client";

import { useEffect, useState } from "react";

interface ApiProject {
  id: string;
  name: string;
  status: string;
  hours: { done: number; total: number | null; pct: number | null };
  assignees: { id: string; name: string }[];
}

interface ApiPerson {
  id: string;
  name: string;
}

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-lg bg-ink p-4 text-xs/5 whitespace-pre text-white/90">
        {code}
      </pre>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(code);
          setCopied(true);
          setTimeout(() => setCopied(false), 1400);
        }}
        className="absolute top-2 right-2 rounded-md bg-white/10 px-2 py-1 text-xs font-semibold text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
      >
        {copied ? "Copié ✓" : "Copier"}
      </button>
    </div>
  );
}

function Result({ data }: { data: unknown }) {
  if (data === null) return null;
  return (
    <pre className="mt-3 max-h-64 overflow-auto rounded-lg bg-cloud p-4 text-xs/5 text-charcoal">
      {JSON.stringify(data, null, 2)}
    </pre>
  );
}

const btn =
  "rounded-lg bg-rausch px-3 py-2 text-sm font-semibold text-white transition-transform active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rausch";
const btnSecondary =
  "rounded-lg px-3 py-2 text-sm font-semibold outline -outline-offset-1 outline-hairline hover:bg-cloud focus-visible:outline-2 focus-visible:outline-ink";

export default function ApiTestPage() {
  const [origin, setOrigin] = useState("");
  const [projects, setProjects] = useState<ApiProject[]>([]);
  const [people, setPeople] = useState<ApiPerson[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedPersonId, setSelectedPersonId] = useState("");
  const [done, setDone] = useState("24");
  const [total, setTotal] = useState("");
  const [resAll, setResAll] = useState<unknown>(null);
  const [resStatus, setResStatus] = useState<unknown>(null);
  const [resOne, setResOne] = useState<unknown>(null);
  const [resPost, setResPost] = useState<unknown>(null);
  const [resPeople, setResPeople] = useState<unknown>(null);
  const [resByPerson, setResByPerson] = useState<unknown>(null);
  const [resSession, setResSession] = useState<unknown>(null);
  const [resCurrent, setResCurrent] = useState<unknown>(null);

  useEffect(() => {
    fetch("/api/projects")
      .then((r) => r.json())
      .then((d) => {
        setOrigin(window.location.origin);
        setProjects(d.projects ?? []);
        if (d.projects?.[0]) setSelectedId(d.projects[0].id);
      })
      .catch(() => setOrigin(window.location.origin));
    fetch("/api/people")
      .then((r) => r.json())
      .then((d) => {
        setPeople(d.people ?? []);
        if (d.people?.[0]) setSelectedPersonId(d.people[0].id);
      })
      .catch(() => {});
  }, []);

  const id = selectedId || "PROJECT_ID";
  const personId = selectedPersonId || "PERSON_ID";
  const selected = projects.find((p) => p.id === selectedId);

  const postSession = (action: "start" | "stop") =>
    fetch("/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        person_id: selectedPersonId,
        project_id: selectedId,
        action,
      }),
    })
      .then((r) => r.json())
      .then(setResSession);

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <p className="text-lg font-semibold tracking-tight">
        Lineup<span className="text-rausch">.</span>{" "}
        <span className="font-medium text-ash">/ console API</span>
      </p>
      <h1 className="mt-6 text-2xl font-semibold tracking-tight text-balance">
        Tester l&rsquo;API projets
      </h1>
      <p className="mt-2 max-w-prose text-base/7 text-ash sm:text-sm/6">
        Sept routes, sans authentification pour l&rsquo;instant — à verrouiller avant
        d&rsquo;y brancher quoi que ce soit de public. Chaque bloc de code se copie tel
        quel.
      </p>

      {/* 1 — GET all */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          1 · Tous les projets{" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            GET /api/projects
          </code>
        </h2>
        <p className="mt-1 text-sm text-ash">
          Statut, dates, heures (faites / vendues / %), personnes associées.
        </p>
        <div className="mt-3">
          <CodeBlock
            code={`const res = await fetch("${origin}/api/projects");
const { count, projects } = await res.json();
// projects[0] = { id, name, status, start_date, end_date, moonmoon,
//   hours: { done, total, pct }, assignees: [{ id, name }] }
console.log(count, projects);`}
          />
        </div>
        <button
          type="button"
          className={`${btn} mt-3`}
          onClick={() =>
            fetch("/api/projects").then((r) => r.json()).then(setResAll)
          }
        >
          Tester GET /api/projects
        </button>
        <Result data={resAll} />
      </section>

      {/* 2 — GET by status */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          2 · Seulement les « En cours »{" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            GET /api/projects?status=demarre
          </code>
        </h2>
        <p className="mt-1 text-sm text-ash">
          Statuts possibles : <code>devise</code> (non démarré), <code>demarre</code> (en
          cours), <code>termine</code>, <code>archive</code>.
        </p>
        <div className="mt-3">
          <CodeBlock
            code={`const res = await fetch("${origin}/api/projects?status=demarre");
const { projects } = await res.json();
// ex. la liste des projets à alimenter en heures
for (const p of projects) {
  console.log(p.name, p.hours.done + "/" + p.hours.total + "h", p.hours.pct + " %");
}`}
          />
        </div>
        <button
          type="button"
          className={`${btn} mt-3`}
          onClick={() =>
            fetch("/api/projects?status=demarre").then((r) => r.json()).then(setResStatus)
          }
        >
          Tester GET ?status=demarre
        </button>
        <Result data={resStatus} />
      </section>

      {/* 3 — GET people */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          3 · L&rsquo;équipe{" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            GET /api/people
          </code>
        </h2>
        <p className="mt-1 text-sm text-ash">
          Tous les membres, même sans projet actif — pour attribuer un écran à une
          personne.
        </p>
        <div className="mt-3">
          <CodeBlock
            code={`const res = await fetch("${origin}/api/people");
const { people } = await res.json();
// people = [{ id, name }]`}
          />
        </div>
        <button
          type="button"
          className={`${btn} mt-3`}
          onClick={() => fetch("/api/people").then((r) => r.json()).then(setResPeople)}
        >
          Tester GET /api/people
        </button>
        <Result data={resPeople} />
      </section>

      {/* 4 — GET projects by person */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          4 · Les projets d&rsquo;une personne{" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            GET /api/projects?status=demarre&amp;person_id=…
          </code>
        </h2>
        <p className="mt-1 text-sm text-ash">
          Le filtrage se fait côté serveur — plus besoin de tout charger.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="person-select" className="text-sm font-medium">
            Personne
          </label>
          <select
            id="person-select"
            name="person-select"
            value={selectedPersonId}
            onChange={(e) => setSelectedPersonId(e.target.value)}
            className="min-w-0 rounded-lg px-3 py-2 text-sm outline -outline-offset-1 outline-hairline focus-visible:outline-2 focus-visible:outline-ink"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <CodeBlock
            code={`const res = await fetch("${origin}/api/projects?status=demarre&person_id=${personId}");
const { projects } = await res.json();
// uniquement les projets « En cours » où la personne est assignée`}
          />
        </div>
        <button
          type="button"
          className={`${btn} mt-3`}
          onClick={() =>
            fetch(`/api/projects?status=demarre&person_id=${selectedPersonId}`)
              .then((r) => r.json())
              .then(setResByPerson)
          }
        >
          Tester ?status=demarre&amp;person_id=…
        </button>
        <Result data={resByPerson} />
      </section>

      {/* 5 — GET one */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          5 · Un projet précis{" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            GET /api/projects/:id
          </code>
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="project-select" className="text-sm font-medium">
            Projet
          </label>
          <select
            id="project-select"
            name="project-select"
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="min-w-0 rounded-lg px-3 py-2 text-sm outline -outline-offset-1 outline-hairline focus-visible:outline-2 focus-visible:outline-ink"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name || "Sans titre"} — {p.status}
              </option>
            ))}
          </select>
        </div>
        <div className="mt-3">
          <CodeBlock
            code={`const res = await fetch("${origin}/api/projects/${id}");
const project = await res.json();
console.log(project.name, project.hours, project.assignees.map(a => a.name));`}
          />
        </div>
        <button
          type="button"
          className={`${btn} mt-3`}
          onClick={() =>
            fetch(`/api/projects/${selectedId}`).then((r) => r.json()).then(setResOne)
          }
        >
          Tester GET /api/projects/:id
        </button>
        <Result data={resOne} />
      </section>

      {/* 6 — Sessions */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          6 · Pointer du temps (sessions){" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            POST /api/sessions
          </code>
        </h2>
        <p className="mt-1 text-sm text-ash">
          Le serveur accumule les heures : <code>start</code> ouvre une session,{" "}
          <code>stop</code> la ferme et crédite le temps écoulé sur{" "}
          <code>hours.done</code>. Une seule session active par personne —{" "}
          <code>start</code> sur un autre projet arrête la précédente.{" "}
          <code>stop</code> sans session → 409. Utilise la personne (section 4) et
          le projet (section 5) sélectionnés ci-dessus.
        </p>
        <div className="mt-3">
          <CodeBlock
            code={`// Démarrer / arrêter
await fetch("${origin}/api/sessions", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    person_id: "${personId}",
    project_id: "${id}",
    action: "start", // ou "stop"
  }),
});

// Lire l'état courant (done inclut le temps de la session en cours)
const res = await fetch("${origin}/api/sessions/current?person_id=${personId}");
const { project_id, started_at, hours } = await res.json();
// pas de session → { project_id: null, started_at: null, hours: null }`}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button type="button" className={btn} onClick={() => postSession("start")}>
            start
          </button>
          <button type="button" className={btnSecondary} onClick={() => postSession("stop")}>
            stop
          </button>
          <button
            type="button"
            className={btnSecondary}
            onClick={() =>
              fetch(`/api/sessions/current?person_id=${selectedPersonId}`)
                .then((r) => r.json())
                .then(setResCurrent)
            }
          >
            GET /current
          </button>
        </div>
        <Result data={resSession} />
        <Result data={resCurrent} />
      </section>

      {/* 7 — POST hours */}
      <section className="mt-10">
        <h2 className="text-base font-semibold tracking-tight">
          7 · Écraser le temps courant{" "}
          <code className="ml-1 rounded bg-cloud px-1.5 py-0.5 text-xs font-medium text-charcoal">
            POST /api/projects/:id/hours
          </code>
        </h2>
        <p className="mt-1 text-sm text-ash">
          Body JSON <code>{`{ "done": 24.5 }`}</code> (optionnel :{" "}
          <code>{`"total"`}</code>). Décimales acceptées (2 max). Refusé si le projet
          n&rsquo;est pas « En cours » (409). ⚠ Écrase la valeur — pour pointer du
          temps depuis un appareil, préférer les sessions (section 6).
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <label htmlFor="hours-done" className="text-sm font-medium">
            done
          </label>
          <input
            id="hours-done"
            name="hours-done"
            type="number"
            min={0}
            value={done}
            onChange={(e) => setDone(e.target.value)}
            className="w-20 rounded-lg px-3 py-2 text-sm tabular-nums outline -outline-offset-1 outline-hairline focus-visible:outline-2 focus-visible:outline-ink"
          />
          <label htmlFor="hours-total" className="text-sm font-medium">
            total
          </label>
          <input
            id="hours-total"
            name="hours-total"
            type="number"
            min={1}
            placeholder="inchangé"
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-24 rounded-lg px-3 py-2 text-sm tabular-nums outline -outline-offset-1 outline-hairline placeholder:text-mute focus-visible:outline-2 focus-visible:outline-ink"
          />
          {selected && (
            <span className="text-xs text-mute tabular-nums">
              actuellement {selected.hours.done}/{selected.hours.total ?? "—"}h
            </span>
          )}
        </div>
        <div className="mt-3">
          <CodeBlock
            code={`const res = await fetch("${origin}/api/projects/${id}/hours", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ done: ${done || 0}${total ? `, total: ${total}` : ""} }),
});
const project = await res.json();
console.log(project.hours); // { done, total, pct } recalculés`}
          />
        </div>
        <button
          type="button"
          className={`${btnSecondary} mt-3`}
          onClick={() =>
            fetch(`/api/projects/${selectedId}/hours`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                done: Number(done) || 0,
                ...(total ? { total: Number(total) } : {}),
              }),
            })
              .then((r) => r.json())
              .then(setResPost)
          }
        >
          Tester POST /hours
        </button>
        <Result data={resPost} />
      </section>

      <p className="mt-12 border-t border-black/8 pt-4 text-xs text-mute">
        Lineup — console API · les routes répondent en CORS ouvert · auth à ajouter
        avant tout usage hors studio.
      </p>
    </main>
  );
}
