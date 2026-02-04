create extension if not exists pg_trgm;

create unique index if not exists investment_journals_user_date_uidx
  on public.investment_journals (user_id, date);

create index if not exists user_profiles_user_id_idx
  on public.user_profiles (user_id);

create index if not exists user_profiles_public_idx
  on public.user_profiles (is_public)
  where is_public = true;

create index if not exists user_profiles_nickname_trgm_idx
  on public.user_profiles
  using gin (nickname gin_trgm_ops)
  where nickname is not null;

create index if not exists dashboard_todos_user_created_idx
  on public.dashboard_todos (user_id, created_at);
