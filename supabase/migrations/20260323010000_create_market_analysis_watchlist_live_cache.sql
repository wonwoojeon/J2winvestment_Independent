create table if not exists public.market_analysis_watchlist_live_cache (
  cache_key text primary key,
  payload_json jsonb not null default '{}'::jsonb,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint market_analysis_watchlist_live_cache_payload_object check (jsonb_typeof(payload_json) = 'object')
);

create index if not exists market_analysis_watchlist_live_cache_expires_idx
  on public.market_analysis_watchlist_live_cache (expires_at desc);

alter table public.market_analysis_watchlist_live_cache enable row level security;

drop policy if exists "market_analysis_watchlist_live_cache_no_public_access" on public.market_analysis_watchlist_live_cache;
create policy "market_analysis_watchlist_live_cache_no_public_access"
  on public.market_analysis_watchlist_live_cache
  for select
  using (false);

create or replace function public.touch_market_analysis_watchlist_live_cache_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists market_analysis_watchlist_live_cache_set_updated_at on public.market_analysis_watchlist_live_cache;
create trigger market_analysis_watchlist_live_cache_set_updated_at
before update on public.market_analysis_watchlist_live_cache
for each row
execute function public.touch_market_analysis_watchlist_live_cache_updated_at();
