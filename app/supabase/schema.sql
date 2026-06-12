-- Lineup — schéma Supabase
-- À exécuter dans le SQL Editor du projet Supabase (plan gratuit suffisant).

create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  avatar text,
  created_at timestamptz default now()
);

create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  start_date date not null,
  end_date date not null,
  status text not null default 'devise'
    check (status in ('devise','a_demarrer','demarre','termine','archive')),
  person_id uuid references people(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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

-- Accès réservé aux utilisateurs authentifiés (compte unique d'équipe).
alter table people enable row level security;
alter table projects enable row level security;

drop policy if exists "people open" on people;
drop policy if exists "projects open" on projects;

create policy "people authenticated" on people
  for all to authenticated using (true) with check (true);
create policy "projects authenticated" on projects
  for all to authenticated using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table projects;
alter publication supabase_realtime add table people;

-- L'équipe (uniquement si la table est vide)
insert into people (name, avatar)
select v.name, v.avatar
from (values
  ('JJ', '/portrait-jj.png'),
  ('Sylvain', '/portrait-sylvain.png'),
  ('Kiks', '/portrait-killian.png')
) as v(name, avatar)
where not exists (select 1 from people);
