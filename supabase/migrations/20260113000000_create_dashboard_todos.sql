create extension if not exists pgcrypto;

create table if not exists public.dashboard_todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists dashboard_todos_user_id_idx on public.dashboard_todos (user_id);
create index if not exists dashboard_todos_created_at_idx on public.dashboard_todos (created_at);

alter table public.dashboard_todos enable row level security;

create policy "dashboard_todos_select_own"
  on public.dashboard_todos
  for select
  using (auth.uid() = user_id);

create policy "dashboard_todos_insert_own"
  on public.dashboard_todos
  for insert
  with check (auth.uid() = user_id);

create policy "dashboard_todos_update_own"
  on public.dashboard_todos
  for update
  using (auth.uid() = user_id);

create policy "dashboard_todos_delete_own"
  on public.dashboard_todos
  for delete
  using (auth.uid() = user_id);
