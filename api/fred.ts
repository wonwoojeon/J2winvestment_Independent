import type { VercelRequest, VercelResponse } from '@vercel/node';

const FRED_BASE_URL = 'https://api.stlouisfed.org/fred/series/observations';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.FRED_API_KEY || process.env.VITE_FRED_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: 'FRED_API_KEY is not set on the server.' });
    return;
  }

  const seriesId = Array.isArray(req.query.series_id)
    ? req.query.series_id[0]
    : req.query.series_id;
  if (!seriesId) {
    res.status(400).json({ error: 'series_id is required.' });
    return;
  }

  const url = new URL(FRED_BASE_URL);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('file_type', 'json');

  const allowedParams = ['observation_start', 'observation_end', 'sort_order', 'limit', 'frequency', 'aggregation_method'];
  allowedParams.forEach((param) => {
    const value = req.query[param];
    if (value) {
      url.searchParams.set(param, Array.isArray(value) ? value[0] : value);
    }
  });

  try {
    const response = await fetch(url.toString());
    const text = await response.text();
    res.status(response.status).send(text);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch FRED data.' });
  }
}
