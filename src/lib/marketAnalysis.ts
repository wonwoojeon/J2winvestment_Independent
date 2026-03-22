import { z } from 'zod';
import type { MarketAnalysisPayload, MarketAnalysisReport, MarketAnalysisReportRow, MarketAnalysisTicker } from '@/types/marketAnalysis';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

const marketAnalysisTickerSchema = z.object({
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  stance: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional()
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

export type NormalizedMarketAnalysisPayload = z.infer<typeof marketAnalysisPayloadSchema>;

const dedupeStrings = (items: string[]) => [...new Set(items.map((item) => item.trim()).filter(Boolean))];

const normalizeTickers = (tickers: MarketAnalysisTicker[]) =>
  tickers
    .map((ticker) => ({
      symbol: ticker.symbol.trim().toUpperCase(),
      name: ticker.name?.trim() || undefined,
      stance: ticker.stance?.trim() || undefined,
      summary: ticker.summary?.trim() || undefined
    }))
    .filter((ticker) => ticker.symbol.length > 0);

export const normalizeMarketAnalysisPayload = (payload: unknown): NormalizedMarketAnalysisPayload => {
  const parsed = marketAnalysisPayloadSchema.parse(payload);

  return {
    ...parsed,
    highlights: dedupeStrings(parsed.highlights),
    tickers: normalizeTickers(parsed.tickers)
  };
};

export const toMarketAnalysisRowInput = (payload: unknown) => {
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

export const mapMarketAnalysisReport = (row: MarketAnalysisReportRow): MarketAnalysisReport => ({
  id: row.id,
  reportDate: row.report_date,
  marketScope: row.market_scope,
  title: row.title,
  summary: row.summary,
  highlights: Array.isArray(row.highlights) ? row.highlights : [],
  tickers: Array.isArray(row.tickers) ? row.tickers : [],
  sourceName: row.source_name,
  sourceUrl: row.source_url,
  rawPayload: row.raw_payload && typeof row.raw_payload === 'object' ? row.raw_payload : {},
  createdAt: row.created_at,
  updatedAt: row.updated_at
});


export const selectPreferredMarketAnalysisReports = (
  reports: MarketAnalysisReport[],
  preferredScope = 'us'
): MarketAnalysisReport[] => reports.filter((report) => report.marketScope === preferredScope);

export const isMarketAnalysisPayloadError = (error: unknown): error is z.ZodError => error instanceof z.ZodError;

export const createMarketAnalysisEmptyState = (): MarketAnalysisReport[] => [];

export const readMarketAnalysisErrorMessage = (error: unknown) => {
  if (isMarketAnalysisPayloadError(error)) {
    return error.issues.map((issue) => issue.message).join(', ');
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};
