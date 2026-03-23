# Market Analysis Ingest Notes

## Purpose

This app does not run `daily_stock_analysis` directly. It receives published market analysis payloads and renders them on `/market-analysis`.

## Required Vercel Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MARKET_ANALYSIS_INGEST_TOKEN`
- `MARKET_ANALYSIS_ADMIN_EMAILS`

`MARKET_ANALYSIS_ADMIN_EMAILS` is a comma-separated admin allowlist.

Example:

```txt
admin1@example.com,admin2@example.com
```

## Ingest Endpoint

- `POST /api/market-analysis-ingest`
- Header: `Authorization: Bearer <MARKET_ANALYSIS_INGEST_TOKEN>`
- Body: JSON payload matching `public/market-analysis-payload.example.json`

## Example Curl

```bash
curl -X POST https://j2winvestment.com/api/market-analysis-ingest \
  -H "Authorization: Bearer $MARKET_ANALYSIS_INGEST_TOKEN" \
  -H "Content-Type: application/json" \
  --data @public/market-analysis-payload.example.json
```

## Suggested Runner Shape

1. Run `daily_stock_analysis` on GitHub Actions.
2. Transform output into the normalized payload format.
3. POST the payload to this app's ingest endpoint.
4. Open `/market-analysis` to verify publication.

## Admin Watchlist

The market analysis page now reads a persistent admin-managed watchlist from `public.market_analysis_watchlist`.

### Required Supabase Migration

Run:

- `supabase/migrations/20260323000000_create_market_analysis_watchlist.sql`

### Watchlist API

- `GET /api/market-analysis-watchlist`
  - public read
  - returns active watchlist items and viewer admin status
- `POST /api/market-analysis-watchlist`
  - admin only
  - requires Supabase session bearer token
- `DELETE /api/market-analysis-watchlist/:id`
  - admin only
  - requires Supabase session bearer token

### Admin Flow

1. Sign in with the Google account whose email is listed in `MARKET_ANALYSIS_ADMIN_EMAILS`.
2. Open `/market-analysis`.
3. Use the `추적 종목 관리` panel to add or delete persistent watchlist items.
4. Public visitors will only see the watchlist cards, not the management UI.
