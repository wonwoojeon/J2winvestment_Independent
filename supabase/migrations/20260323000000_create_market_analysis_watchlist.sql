create table if not exists public.market_analysis_watchlist (
  id uuid primary key default gen_random_uuid(),
  symbol text not null,
  name text,
  stance text,
  summary text,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_by_email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_analysis_watchlist_symbol_unique unique (symbol)
);

create index if not exists market_analysis_watchlist_active_order_idx
  on public.market_analysis_watchlist (is_active, sort_order, created_at);

alter table public.market_analysis_watchlist enable row level security;

drop policy if exists "market_analysis_watchlist_public_read" on public.market_analysis_watchlist;
create policy "market_analysis_watchlist_public_read"
  on public.market_analysis_watchlist
  for select
  using (is_active = true);

create or replace function public.touch_market_analysis_watchlist_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_analysis_watchlist_set_updated_at on public.market_analysis_watchlist;
create trigger market_analysis_watchlist_set_updated_at
before update on public.market_analysis_watchlist
for each row
execute function public.touch_market_analysis_watchlist_updated_at();
