import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type'
};

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const marketAnalysisTickerNewsSchema = z.object({
  title: z.string().trim().min(1),
  url: z.string().trim().url(),
  source: z.string().trim().min(1).optional(),
  publishedAt: z.string().trim().min(1).optional()
});

const marketAnalysisTickerSchema = z.object({
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  stance: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  adminNote: z.string().trim().min(1).optional(),
  price: z.number().finite().optional(),
  change: z.number().finite().optional(),
  changePercent: z.number().finite().optional(),
  currency: z.string().trim().min(1).optional(),
  sessionLabel: z.string().trim().min(1).optional(),
  commentary: z.string().trim().min(1).optional(),
  refreshedAt: z.string().trim().min(1).optional(),
  news: z.array(marketAnalysisTickerNewsSchema).optional().default([])
});

const marketAnalysisPayloadSchema = z.object({
  reportDate: z.string().regex(datePattern, 'reportDate must be YYYY-MM-DD'),
  marketScope: z.string().trim().min(1).optional().default('us'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  highlights: z.array(z.string().trim().min(1)).optional().default([]),
  tickers: z.array(marketAnalysisTickerSchema).optional().default([]),
  sourceName: z.string().trim().min(1).optional().default('daily_stock_analysis'),
  sourceUrl: z.string().trim().url().optional(),
  rawPayload: z.record(z.unknown()).optional().default({})
});

type RequestLike = {
  method?: string;
  headers: {
    authorization?: string | string[];
  };
  body?: unknown;
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
  end: () => void;
};

const dedupeStrings = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];
const normalizeWhitespace = (value: string) => value.replace(/\s+/g, ' ').trim();

const isRenderableHighlight = (value: string) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return false;
  if (/^[|:\-\s]+$/.test(normalized)) return false;
  if ((normalized.match(/\|/g)?.length ?? 0) >= 2) return false;
  return (normalized.match(/[A-Za-z0-9가-힣]/g)?.length ?? 0) >= 4;
};

const sanitizeMarketAnalysisHighlights = (items: string[]) =>
  dedupeStrings(items.map(normalizeWhitespace).filter(isRenderableHighlight));

const normalizeTickers = (tickers: Array<z.infer<typeof marketAnalysisTickerSchema>>) =>
  tickers
    .map((ticker) => ({
      symbol: ticker.symbol.trim().toUpperCase(),
      name: ticker.name?.trim() || undefined,
      stance: ticker.stance?.trim() || undefined,
      summary: ticker.summary?.trim() || undefined,
      adminNote: ticker.adminNote?.trim() || undefined,
      price: typeof ticker.price === 'number' ? ticker.price : undefined,
      change: typeof ticker.change === 'number' ? ticker.change : undefined,
      changePercent: typeof ticker.changePercent === 'number' ? ticker.changePercent : undefined,
      currency: ticker.currency?.trim() || undefined,
      sessionLabel: ticker.sessionLabel?.trim() || undefined,
      commentary: ticker.commentary?.trim() || undefined,
      refreshedAt: ticker.refreshedAt?.trim() || undefined,
      news: (ticker.news || [])
        .map((item) => ({
          title: item.title.trim(),
          url: item.url.trim(),
          source: item.source?.trim() || undefined,
          publishedAt: item.publishedAt?.trim() || undefined
        }))
        .filter((item) => item.title.length > 0 && item.url.length > 0)
    }))
    .filter((ticker) => ticker.symbol.length > 0);

const normalizeMarketAnalysisPayload = (payload: unknown) => {
  const parsed = marketAnalysisPayloadSchema.parse(payload);

  return {
    ...parsed,
    highlights: sanitizeMarketAnalysisHighlights(parsed.highlights),
    tickers: normalizeTickers(parsed.tickers)
  };
};

const toMarketAnalysisRowInput = (payload: unknown) => {
  const normalized = normalizeMarketAnalysisPayload(payload);

  return {
    report_date: normalized.reportDate,
    market_scope: normalized.marketScope,
    title: normalized.title,
    summary: normalized.summary,
    highlights: normalized.highlights,
    tickers: normalized.tickers,
    source_name: normalized.sourceName,
    source_url: normalized.sourceUrl ?? null,
    raw_payload: normalized.rawPayload,
    updated_at: new Date().toISOString()
  };
};

const isMarketAnalysisPayloadError = (error: unknown): error is z.ZodError => error instanceof z.ZodError;

const readMarketAnalysisErrorMessage = (error: unknown) => {
  if (isMarketAnalysisPayloadError(error)) {
    return error.issues.map((issue) => issue.message).join(', ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};

const readBearerToken = (authorizationHeader?: string | string[]) => {
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  Object.entries(corsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const expectedToken = process.env.MARKET_ANALYSIS_INGEST_TOKEN;
  const providedToken = readBearerToken(req.headers.authorization);

  if (!expectedToken || providedToken !== expectedToken) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    res.status(500).json({ error: 'Supabase server credentials are not configured.' });
    return;
  }

  try {
    const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const row = toMarketAnalysisRowInput(payload);
    const admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await admin
      .from('market_analysis_reports')
      .upsert(row, { onConflict: 'report_date,market_scope,source_name' })
      .select('id, report_date, market_scope, title, source_name')
      .single();

    if (error) {
      throw error;
    }

    res.status(200).json({ ok: true, report: data });
  } catch (error) {
    if (isMarketAnalysisPayloadError(error)) {
      res.status(400).json({ error: readMarketAnalysisErrorMessage(error) });
      return;
    }

    console.error('market-analysis-ingest error', error);
    res.status(500).json({ error: 'Failed to ingest market analysis.' });
  }
}
