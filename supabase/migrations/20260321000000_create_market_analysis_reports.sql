create extension if not exists pgcrypto;

create table if not exists public.market_analysis_reports (
  id uuid primary key default gen_random_uuid(),
  report_date date not null,
  market_scope text not null default 'us',
  title text not null,
  summary text not null,
  highlights jsonb not null default '[]'::jsonb,
  tickers jsonb not null default '[]'::jsonb,
  source_name text not null default 'daily_stock_analysis',
  source_url text,
  raw_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_analysis_reports_unique unique (report_date, market_scope, source_name),
  constraint market_analysis_reports_highlights_array check (jsonb_typeof(highlights) = 'array'),
  constraint market_analysis_reports_tickers_array check (jsonb_typeof(tickers) = 'array'),
  constraint market_analysis_reports_payload_object check (jsonb_typeof(raw_payload) = 'object')
);

create index if not exists market_analysis_reports_date_idx
  on public.market_analysis_reports (report_date desc, created_at desc);

alter table public.market_analysis_reports enable row level security;

drop policy if exists "market_analysis_reports_public_read" on public.market_analysis_reports;
create policy "market_analysis_reports_public_read"
  on public.market_analysis_reports
  for select
  using (true);

create or replace function public.touch_market_analysis_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists market_analysis_reports_set_updated_at on public.market_analysis_reports;
create trigger market_analysis_reports_set_updated_at
before update on public.market_analysis_reports
for each row
execute function public.touch_market_analysis_reports_updated_at();
