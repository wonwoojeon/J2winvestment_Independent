import type { MarketAnalysisTicker, MarketAnalysisWatchlistItem } from '../../src/types/marketAnalysis.ts';

export const WATCHLIST_LIVE_CACHE_KEY = 'watchlist_live_us_v1';
export const WATCHLIST_LIVE_TTL_MS = 5 * 60 * 1000;

export type MarketAnalysisWatchlistLivePayload = {
  items: MarketAnalysisTicker[];
  refreshedAt: string;
};

export type MarketAnalysisWatchlistLiveCacheRow = {
  cache_key: string;
  payload_json: MarketAnalysisWatchlistLivePayload;
  fetched_at: string;
  expires_at: string;
  updated_at?: string;
};

type StooqDailyRow = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export const buildWatchlistLiveCacheRow = (
  items: MarketAnalysisTicker[],
  fetchedAt = new Date(),
  ttlMs = WATCHLIST_LIVE_TTL_MS,
): MarketAnalysisWatchlistLiveCacheRow => {
  const normalizedFetchedAt = fetchedAt.toISOString();

  return {
    cache_key: WATCHLIST_LIVE_CACHE_KEY,
    payload_json: {
      items,
      refreshedAt: normalizedFetchedAt,
    },
    fetched_at: normalizedFetchedAt,
    expires_at: new Date(fetchedAt.getTime() + ttlMs).toISOString(),
    updated_at: normalizedFetchedAt,
  };
};

export const readFreshWatchlistLivePayload = (
  row: Pick<MarketAnalysisWatchlistLiveCacheRow, 'payload_json' | 'expires_at'> | null | undefined,
  now = new Date(),
) => {
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= now.getTime()) return null;
  return row.payload_json;
};

const overlayLiveTicker = (
  baseTicker: MarketAnalysisTicker,
  liveTicker: MarketAnalysisTicker | undefined,
): MarketAnalysisTicker => {
  if (!liveTicker) return baseTicker;

  return {
    ...baseTicker,
    price: liveTicker.price ?? baseTicker.price,
    change: liveTicker.change ?? baseTicker.change,
    changePercent: liveTicker.changePercent ?? baseTicker.changePercent,
    currency: liveTicker.currency ?? baseTicker.currency,
    sessionLabel: liveTicker.sessionLabel ?? baseTicker.sessionLabel,
    refreshedAt: liveTicker.refreshedAt ?? baseTicker.refreshedAt,
    news: liveTicker.news && liveTicker.news.length > 0 ? liveTicker.news : baseTicker.news,
  };
};

export const mergeWatchlistLiveSnapshots = (
  baseTickers: MarketAnalysisTicker[],
  liveTickers: MarketAnalysisTicker[],
) => {
  const liveBySymbol = new Map(liveTickers.map((ticker) => [ticker.symbol.trim().toUpperCase(), ticker]));

  return baseTickers.map((ticker) =>
    overlayLiveTicker(ticker, liveBySymbol.get(ticker.symbol.trim().toUpperCase())),
  );
};

const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36';

const yahooRequest = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Yahoo request failed with status ${response.status}`);
  }

  return response.json() as Promise<any>;
};

const stooqRequest = async (url: string) => {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'text/csv,text/plain;q=0.9,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`Stooq request failed with status ${response.status}`);
  }

  return response.text();
};

const roundValue = (value: number | undefined) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return undefined;
  return Math.round(value * 100) / 100;
};

const parseMaybeNumber = (value: string | undefined) => {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const normalizeSymbolForStooq = (symbol: string) => {
  const normalized = symbol.trim().toLowerCase();
  if (!normalized) return normalized;
  return normalized.includes('.') ? normalized : `${normalized}.us`;
};

export const parseStooqHistoryCsv = (csv: string): StooqDailyRow[] =>
  csv
    .split(/\r?\n/)
    .slice(1)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [date, open, high, low, close, volume] = line.split(',');
      const parsedOpen = parseMaybeNumber(open);
      const parsedHigh = parseMaybeNumber(high);
      const parsedLow = parseMaybeNumber(low);
      const parsedClose = parseMaybeNumber(close);
      const parsedVolume = parseMaybeNumber(volume);

      if (!date || parsedOpen === undefined || parsedHigh === undefined || parsedLow === undefined || parsedClose === undefined || parsedVolume === undefined) {
        return null;
      }

      return {
        date,
        open: parsedOpen,
        high: parsedHigh,
        low: parsedLow,
        close: parsedClose,
        volume: parsedVolume,
      } satisfies StooqDailyRow;
    })
    .filter((row): row is StooqDailyRow => Boolean(row));

export const fetchStooqQuoteSnapshot = async (symbol: string) => {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const payload = await stooqRequest(
    `https://stooq.com/q/d/l/?s=${encodeURIComponent(normalizeSymbolForStooq(symbol))}&i=d`,
  );

  const rows = parseStooqHistoryCsv(payload);
  const lastRow = rows.at(-1);
  if (!lastRow) {
    throw new Error(`Stooq history unavailable for ${normalizedSymbol}`);
  }

  const previousClose = rows.at(-2)?.close ?? lastRow.open;
  const change = typeof previousClose === 'number' ? lastRow.close - previousClose : undefined;
  const changePercent = typeof change === 'number' && previousClose !== 0
    ? (change / previousClose) * 100
    : undefined;

  return {
    symbol: normalizedSymbol,
    name: normalizedSymbol,
    price: roundValue(lastRow.close),
    change: roundValue(change),
    changePercent: roundValue(changePercent),
    currency: 'USD',
    sessionLabel: '최근 종가',
    refreshedAt: new Date().toISOString(),
  } satisfies MarketAnalysisTicker;
};

export const fetchYahooQuoteSnapshot = async (symbol: string) => {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const encodedSymbol = encodeURIComponent(normalizedSymbol);
  const payload = await yahooRequest(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodedSymbol}?interval=1d&range=5d`,
  );

  const result = payload?.chart?.result?.[0];
  const meta = result?.meta || {};
  const price = typeof meta.regularMarketPrice === 'number'
    ? meta.regularMarketPrice
    : result?.indicators?.quote?.[0]?.close?.filter((value: unknown) => typeof value === 'number').at(-1);
  const previousClose = typeof meta.chartPreviousClose === 'number' ? meta.chartPreviousClose : undefined;
  const change = typeof price === 'number' && typeof previousClose === 'number' ? price - previousClose : undefined;
  const changePercent = typeof change === 'number' && typeof previousClose === 'number' && previousClose !== 0
    ? (change / previousClose) * 100
    : undefined;

  return {
    symbol: normalizedSymbol,
    name: meta.longName || meta.shortName || normalizedSymbol,
    price: roundValue(price),
    change: roundValue(change),
    changePercent: roundValue(changePercent),
    currency: typeof meta.currency === 'string' ? meta.currency : 'USD',
    sessionLabel: '최근 시세',
    refreshedAt: new Date().toISOString(),
  } satisfies MarketAnalysisTicker;
};

export const fetchYahooNews = async (symbol: string) => {
  const query = encodeURIComponent(`${symbol.trim().toUpperCase()} stock`);
  const payload = await yahooRequest(
    `https://query1.finance.yahoo.com/v1/finance/search?q=${query}&quotesCount=0&newsCount=2`,
  );

  const news = Array.isArray(payload?.news) ? payload.news : [];
  return news.slice(0, 2).map((item: any) => ({
    title: String(item?.title || '').trim(),
    url: String(item?.link || '').trim(),
    source: String(item?.publisher || '').trim() || undefined,
    publishedAt: typeof item?.providerPublishTime === 'number'
      ? new Date(item.providerPublishTime * 1000).toISOString()
      : undefined,
  })).filter((item: { title: string; url: string }) => item.title.length > 0 && item.url.length > 0);
};

export const buildWatchlistLiveTicker = async (item: MarketAnalysisWatchlistItem) => {
  const quote = await fetchYahooQuoteSnapshot(item.symbol).catch(() => fetchStooqQuoteSnapshot(item.symbol));
  const news = await fetchYahooNews(item.symbol).catch(() => []);

  return {
    ...quote,
    symbol: item.symbol,
    name: item.name || quote.name,
    stance: item.stance,
    adminNote: item.summary,
    news,
  } satisfies MarketAnalysisTicker;
};

export const fetchWatchlistLiveTickers = async (items: MarketAnalysisWatchlistItem[]) => {
  const results = await Promise.all(
    items.map(async (item) => {
      try {
        return await buildWatchlistLiveTicker(item);
      } catch {
        return {
          symbol: item.symbol,
          name: item.name,
          stance: item.stance,
          adminNote: item.summary,
          sessionLabel: '갱신 실패',
          refreshedAt: new Date().toISOString(),
          news: [],
        } satisfies MarketAnalysisTicker;
      }
    }),
  );

  return results;
};
