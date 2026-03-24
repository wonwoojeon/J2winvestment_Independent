import { z } from 'zod';

import {
  normalizeAssetLookupSymbol,
  normalizeAssetTickerInput,
  selectHistoricalCloseOnOrBeforeDate,
  type AssetPriceLookupMarket,
  type HistoricalCloseRow,
} from '../src/lib/assetPriceLookup';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'content-type',
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const querySchema = z.object({
  symbol: z.string().trim().min(1),
  date: z.string().regex(datePattern, 'date must be YYYY-MM-DD').optional(),
  market: z.enum(['us', 'kr', 'crypto']).optional().default('us'),
});

type RequestLike = {
  method?: string;
  url?: string;
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
  end: () => void;
};

const resolveRequestUrl = (req: RequestLike) => {
  const rawUrl = req.url || '/api/asset-price';
  return new URL(rawUrl, 'https://j2winvestment.local');
};

const readTargetDate = (input?: string) => input || new Date().toISOString().slice(0, 10);

const parseStooqCsv = (csv: string): HistoricalCloseRow[] => {
  const text = csv.trim();
  if (!text || text === 'No data') {
    return [];
  }

  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = headerLine.split(',').map((header) => header.trim());
  const dateIndex = headers.indexOf('Date');
  const closeIndex = headers.indexOf('Close');

  if (dateIndex < 0 || closeIndex < 0) {
    throw new Error('Unexpected stooq response format');
  }

  return lines
    .map((line) => line.split(','))
    .map((columns) => ({
      date: columns[dateIndex]?.trim() || '',
      close: Number(columns[closeIndex]),
    }))
    .filter((row) => datePattern.test(row.date) && Number.isFinite(row.close));
};

const buildStooqUrl = (lookupSymbol: string) =>
  `https://stooq.com/q/d/l/?s=${encodeURIComponent(lookupSymbol)}&i=d`;

const fetchHistoricalRows = async (lookupSymbol: string): Promise<HistoricalCloseRow[]> => {
  const response = await fetch(buildStooqUrl(lookupSymbol));
  if (!response.ok) {
    throw new Error(`Failed to fetch historical prices: ${response.status}`);
  }

  const csv = await response.text();
  return parseStooqCsv(csv);
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const url = resolveRequestUrl(req);
    const parsed = querySchema.parse({
      symbol: url.searchParams.get('symbol'),
      date: url.searchParams.get('date') || undefined,
      market: (url.searchParams.get('market') || 'us') as AssetPriceLookupMarket,
    });

    const effectiveDate = readTargetDate(parsed.date);
    const lookupSymbol = normalizeAssetLookupSymbol(parsed.symbol, parsed.market);

    if (!lookupSymbol) {
      res.status(400).json({ error: 'Automatic price lookup supports US stocks and crypto tickers only.' });
      return;
    }

    const rows = await fetchHistoricalRows(lookupSymbol);
    const resolved = selectHistoricalCloseOnOrBeforeDate(rows, effectiveDate);

    if (!resolved) {
      res.status(404).json({ error: 'No historical close was found for the requested date.' });
      return;
    }

    res.status(200).json({
      ok: true,
      symbol: normalizeAssetTickerInput(parsed.symbol, parsed.market),
      market: parsed.market,
      price: resolved.close,
      effectiveDate: resolved.date,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.issues.map((issue) => issue.message).join(', ') });
      return;
    }

    console.error('asset-price error', error);
    res.status(500).json({ error: 'Failed to fetch asset price.' });
  }
}
