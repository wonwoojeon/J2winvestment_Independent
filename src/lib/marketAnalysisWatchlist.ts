import { z } from 'zod';

import type {
  MarketAnalysisReport,
  MarketAnalysisTicker,
  MarketAnalysisWatchlistInput,
  MarketAnalysisWatchlistItem,
  MarketAnalysisWatchlistLiveResponse,
  MarketAnalysisWatchlistResponse,
  MarketAnalysisWatchlistRow,
} from '../types/marketAnalysis.ts';

const marketAnalysisWatchlistInputSchema = z.object({
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  stance: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().min(0).optional().default(100),
});

export type NormalizedMarketAnalysisWatchlistInput = z.infer<typeof marketAnalysisWatchlistInputSchema>;

export const normalizeMarketAnalysisWatchlistInput = (
  input: MarketAnalysisWatchlistInput | unknown,
): NormalizedMarketAnalysisWatchlistInput => {
  const parsed = marketAnalysisWatchlistInputSchema.parse(input);

  return {
    symbol: parsed.symbol.trim().toUpperCase(),
    name: parsed.name?.trim() || undefined,
    stance: parsed.stance?.trim() || undefined,
    summary: parsed.summary?.trim() || undefined,
    sortOrder: parsed.sortOrder,
  };
};

export const mapMarketAnalysisWatchlistItem = (
  row: MarketAnalysisWatchlistRow,
): MarketAnalysisWatchlistItem => ({
  id: row.id,
  symbol: row.symbol,
  name: row.name ?? undefined,
  stance: row.stance ?? undefined,
  summary: row.summary ?? undefined,
  sortOrder: row.sort_order,
  isActive: row.is_active,
  createdByEmail: row.created_by_email ?? undefined,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export const selectActiveMarketAnalysisWatchlist = (
  items: MarketAnalysisWatchlistItem[],
): MarketAnalysisWatchlistItem[] =>
  items
    .filter((item) => item.isActive)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });

export const readWatchlistSummary = (
  report: MarketAnalysisReport | null,
  watchlistItems: MarketAnalysisWatchlistItem[],
) => {
  if (watchlistItems.length > 0) {
    return {
      countLabel: `${watchlistItems.length}개`,
      detail: '상시 추적 기준',
      usesPersistentWatchlist: true,
    };
  }

  const reportTickerCount = report?.tickers.length || 0;
  return {
    countLabel: `${reportTickerCount}개`,
    detail: reportTickerCount > 0 ? '오늘 리포트 기준' : '등록 전',
    usesPersistentWatchlist: false,
  };
};

const mergeTickerOverlay = (
  baseTicker: MarketAnalysisTicker,
  overlayTicker: MarketAnalysisTicker | undefined,
): MarketAnalysisTicker => {
  if (!overlayTicker) return baseTicker;

  return {
    ...baseTicker,
    price: overlayTicker.price ?? baseTicker.price,
    change: overlayTicker.change ?? baseTicker.change,
    changePercent: overlayTicker.changePercent ?? baseTicker.changePercent,
    currency: overlayTicker.currency ?? baseTicker.currency,
    sessionLabel: overlayTicker.sessionLabel ?? baseTicker.sessionLabel,
    refreshedAt: overlayTicker.refreshedAt ?? baseTicker.refreshedAt,
    news: overlayTicker.news && overlayTicker.news.length > 0 ? overlayTicker.news : baseTicker.news,
  };
};

export const readWatchlistBaseTickers = (
  report: MarketAnalysisReport | null,
  watchlistItems: MarketAnalysisWatchlistItem[],
): MarketAnalysisTicker[] => {
  const reportTickers = report?.tickers || [];
  if (watchlistItems.length === 0) {
    return reportTickers;
  }

  const reportTickerBySymbol = new Map(
    reportTickers.map((ticker) => [ticker.symbol.trim().toUpperCase(), ticker]),
  );

  return watchlistItems.map((item) => {
    const reportTicker = reportTickerBySymbol.get(item.symbol.trim().toUpperCase());

    return {
      symbol: item.symbol,
      name: item.name || reportTicker?.name,
      stance: item.stance || reportTicker?.stance,
      summary: reportTicker?.summary,
      adminNote: item.summary || reportTicker?.adminNote,
      price: reportTicker?.price,
      change: reportTicker?.change,
      changePercent: reportTicker?.changePercent,
      currency: reportTicker?.currency,
      sessionLabel: reportTicker?.sessionLabel,
      commentary: reportTicker?.commentary,
      refreshedAt: reportTicker?.refreshedAt,
      news: reportTicker?.news || [],
    } satisfies MarketAnalysisTicker;
  });
};

export const mergeMarketAnalysisLiveTickers = (
  baseTickers: MarketAnalysisTicker[],
  overlayTickers: MarketAnalysisTicker[],
) => {
  const overlayBySymbol = new Map(
    overlayTickers.map((ticker) => [ticker.symbol.trim().toUpperCase(), ticker]),
  );

  return baseTickers.map((ticker) =>
    mergeTickerOverlay(ticker, overlayBySymbol.get(ticker.symbol.trim().toUpperCase())),
  );
};

const readApiError = async (response: Response) => {
  try {
    const payload = await response.json();
    if (typeof payload?.error === 'string' && payload.error.length > 0) {
      return payload.error;
    }
  } catch {
    // ignore JSON parse failures
  }

  return `Request failed with status ${response.status}`;
};

const buildAuthHeaders = (accessToken?: string | null) => {
  if (!accessToken) return undefined;
  return { Authorization: `Bearer ${accessToken}` };
};

export const fetchMarketAnalysisWatchlist = async (
  accessToken?: string | null,
): Promise<MarketAnalysisWatchlistResponse> => {
  const response = await fetch('/api/market-analysis-watchlist', {
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as MarketAnalysisWatchlistResponse;
  return {
    ...payload,
    items: selectActiveMarketAnalysisWatchlist(payload.items || []),
  };
};

export const fetchMarketAnalysisWatchlistLive = async (): Promise<MarketAnalysisWatchlistLiveResponse> => {
  const response = await fetch('/api/market-analysis-watchlist/live');

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as MarketAnalysisWatchlistLiveResponse;
  return {
    ...payload,
    items: payload.items || [],
  };
};

export const createMarketAnalysisWatchlistItem = async (
  input: MarketAnalysisWatchlistInput,
  accessToken?: string | null,
) => {
  const response = await fetch('/api/market-analysis-watchlist', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...buildAuthHeaders(accessToken),
    },
    body: JSON.stringify(normalizeMarketAnalysisWatchlistInput(input)),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { item: MarketAnalysisWatchlistItem };
  return payload.item;
};

export const deleteMarketAnalysisWatchlistItem = async (
  id: string,
  accessToken?: string | null,
) => {
  const response = await fetch(`/api/market-analysis-watchlist/${id}`, {
    method: 'DELETE',
    headers: buildAuthHeaders(accessToken),
  });

  if (!response.ok) {
    throw new Error(await readApiError(response));
  }

  const payload = (await response.json()) as { id: string };
  return payload.id;
};
