# Market Analysis Ingest Notes

## Purpose

This app does not run `daily_stock_analysis` directly. It receives published market analysis payloads and renders them on `/market-analysis`.

## Required Vercel Environment Variables

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MARKET_ANALYSIS_INGEST_TOKEN`

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
