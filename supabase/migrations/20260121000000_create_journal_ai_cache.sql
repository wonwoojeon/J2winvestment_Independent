create table if not exists public.journal_ai_cache (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  cache_key text not null,
  cache_type text not null,
  source_hash text not null,
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists journal_ai_cache_user_key_idx
  on public.journal_ai_cache (user_id, cache_key);

create index if not exists journal_ai_cache_user_type_idx
  on public.journal_ai_cache (user_id, cache_type);

alter table public.journal_ai_cache enable row level security;

create policy "journal_ai_cache_select_own"
  on public.journal_ai_cache
  for select
  using (auth.uid() = user_id);

create policy "journal_ai_cache_insert_own"
  on public.journal_ai_cache
  for insert
  with check (auth.uid() = user_id);

create policy "journal_ai_cache_update_own"
  on public.journal_ai_cache
  for update
  using (auth.uid() = user_id);

create policy "journal_ai_cache_delete_own"
  on public.journal_ai_cache
  for delete
  using (auth.uid() = user_id);
