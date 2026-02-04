create table if not exists public.journal_ai_comments (
  id uuid primary key default gen_random_uuid(),
  journal_id uuid not null references public.investment_journals(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  sentiment text not null check (sentiment in ('pro', 'con')),
  persona text not null,
  content text not null,
  created_at timestamptz not null default now()
);

create index if not exists journal_ai_comments_journal_idx
  on public.journal_ai_comments (journal_id, created_at desc);

create index if not exists journal_ai_comments_user_idx
  on public.journal_ai_comments (user_id);

alter table public.journal_ai_comments enable row level security;

create policy "journal_ai_comments_select_own"
  on public.journal_ai_comments
  for select
  using (auth.uid() = user_id);

create policy "journal_ai_comments_insert_own"
  on public.journal_ai_comments
  for insert
  with check (auth.uid() = user_id);

create policy "journal_ai_comments_update_own"
  on public.journal_ai_comments
  for update
  using (auth.uid() = user_id);

create policy "journal_ai_comments_delete_own"
  on public.journal_ai_comments
  for delete
  using (auth.uid() = user_id);
