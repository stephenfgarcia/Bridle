-- Agent HQ schema: one project, its agents, and their activity feed.
-- Field names mirror src/data/types.ts (snake_case here, camelCase in the app).

create table if not exists public.projects (
  id text primary key,
  name text not null,
  deadline date not null,
  milestones jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.agents (
  id text primary key,
  project_id text not null references public.projects (id) on delete cascade,
  name text not null,
  role text not null,
  color text not null default '#8b5cf6',
  status text not null default 'idle'
    check (status in ('working', 'thinking', 'waiting', 'blocked', 'idle', 'done')),
  current_task text not null default '',
  task_description text not null default '',
  progress integer not null default 0 check (progress between 0 and 100),
  subtasks jsonb not null default '[]'::jsonb,
  waiting_on text,
  blocked_reason text,
  next_up text not null default '',
  status_since timestamptz not null default now(),
  sort_order integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.agent_activity (
  id bigint generated always as identity primary key,
  agent_id text not null references public.agents (id) on delete cascade,
  time timestamptz not null default now(),
  text text not null,
  kind text check (kind in ('done', 'start', 'status', 'note'))
);

create index if not exists agent_activity_agent_time
  on public.agent_activity (agent_id, time desc);

create or replace function public.set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists agents_set_updated_at on public.agents;
create trigger agents_set_updated_at
  before update on public.agents
  for each row execute function public.set_updated_at();

-- The dashboard reads with the public anon key; every write goes through the API server,
-- which uses the service role key. So: read-only policies, nothing else.
alter table public.projects enable row level security;
alter table public.agents enable row level security;
alter table public.agent_activity enable row level security;

drop policy if exists "projects are readable" on public.projects;
create policy "projects are readable" on public.projects
  for select to anon, authenticated using (true);

drop policy if exists "agents are readable" on public.agents;
create policy "agents are readable" on public.agents
  for select to anon, authenticated using (true);

drop policy if exists "activity is readable" on public.agent_activity;
create policy "activity is readable" on public.agent_activity
  for select to anon, authenticated using (true);

-- Realtime: stream every change with full rows, so deletes carry their ids.
alter table public.projects replica identity full;
alter table public.agents replica identity full;
alter table public.agent_activity replica identity full;

do $$
begin
  alter publication supabase_realtime add table public.projects;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.agents;
exception when duplicate_object then null;
end $$;

do $$
begin
  alter publication supabase_realtime add table public.agent_activity;
exception when duplicate_object then null;
end $$;
