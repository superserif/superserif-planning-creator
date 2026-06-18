-- Lineup — schéma Supabase
-- À exécuter dans le SQL Editor du projet Supabase (plan gratuit suffisant).

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text,
  capacity int not null default 3,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  start_date date not null,
  end_date date not null,
  status text not null default 'devise'
    check (status in ('devise','demarre','termine','archive')),
  person_id uuid references people(id) on delete set null, -- hérité, remplacé par assignees
  assignees uuid[] not null default '{}',
  moonmoon boolean not null default false,
  holiday boolean not null default false, -- congés : bloque toute autre association
  hours_done int not null default 0,
  hours_total int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Réglages applicatifs (dont le secret du lien de partage)
create table if not exists app_settings (
  key text primary key,
  value text not null
);

-- Migration : ajoute la colonne « congés » sur une base déjà créée.
alter table projects add column if not exists holiday boolean not null default false;

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists projects_updated_at on projects;
create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- Lecture pour tout utilisateur authentifié ; écriture interdite au compte
-- de partage lecture seule (partage@superserif.studio).
alter table people enable row level security;
alter table projects enable row level security;
alter table app_settings enable row level security;

drop policy if exists "people open" on people;
drop policy if exists "projects open" on projects;

create policy "settings read" on app_settings for select to authenticated using (true);
create policy "people read" on people for select to authenticated using (true);
create policy "projects read" on projects for select to authenticated using (true);
create policy "people insert" on people for insert to authenticated
  with check ((auth.jwt() ->> 'email') <> 'partage@superserif.studio');
create policy "people update" on people for update to authenticated
  using ((auth.jwt() ->> 'email') <> 'partage@superserif.studio');
create policy "people delete" on people for delete to authenticated
  using ((auth.jwt() ->> 'email') <> 'partage@superserif.studio');
create policy "projects insert" on projects for insert to authenticated
  with check ((auth.jwt() ->> 'email') <> 'partage@superserif.studio');
create policy "projects update" on projects for update to authenticated
  using ((auth.jwt() ->> 'email') <> 'partage@superserif.studio');
create policy "projects delete" on projects for delete to authenticated
  using ((auth.jwt() ->> 'email') <> 'partage@superserif.studio');

-- Realtime
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table people;

-- L'équipe (uniquement si la table est vide)
insert into people (name, avatar, capacity)
select v.name, v.avatar, v.capacity
from (values
  ('JJ', '/portrait-jj.png', 4),
  ('Sylvain', '/portrait-sylvain.png', 3),
  ('Kiks', '/portrait-killian.png', 4)
) as v(name, avatar, capacity)
where not exists (select 1 from people);
