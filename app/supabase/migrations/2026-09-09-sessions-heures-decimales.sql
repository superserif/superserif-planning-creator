-- Migration v1.6 — sessions de temps + heures décimales
-- À exécuter dans le SQL Editor du projet Supabase (idempotent).

-- Sessions de temps (écran e-paper & co) : le serveur accumule les heures,
-- les clients démarrent/arrêtent et lisent — plus d'écrasement de total.
create table if not exists work_sessions (
  id uuid primary key default gen_random_uuid(),
  person_id uuid not null references people(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  hours numeric(8,2), -- durée créditée à la fermeture
  created_at timestamptz default now()
);

-- Une seule session active par personne (garde-fou contre les courses).
create unique index if not exists work_sessions_one_active_per_person
  on work_sessions (person_id) where ended_at is null;

-- Incrément atomique des heures faites — jamais de lecture-modification-écriture.
create or replace function add_project_hours(p_project_id uuid, p_hours numeric)
returns void
language sql
security definer
set search_path = public
as $$
  update projects
  set hours_done = round(coalesce(hours_done, 0) + p_hours, 2)
  where id = p_project_id;
$$;

-- Heures faites en décimal (2 décimales) — l'API et les sessions créditent
-- des durées non entières.
alter table projects alter column hours_done type numeric(8,2)
  using round(hours_done::numeric, 2);
alter table projects alter column hours_done set default 0;

-- RLS : les sessions ne s'écrivent que via l'API serveur (service role) ;
-- lecture ouverte aux comptes authentifiés de l'app.
alter table work_sessions enable row level security;
drop policy if exists "sessions read" on work_sessions;
create policy "sessions read" on work_sessions for select to authenticated using (true);
