import type { MarketAnalysisWatchlistRow } from '../../src/types/marketAnalysis.ts';
import {
  createWatchlistAdminClient,
  mapMarketAnalysisWatchlistRows,
  readWatchlistServerEnv,
  watchlistCorsHeaders,
} from '../lib/market-analysis-watchlist.js';
import {
  WATCHLIST_LIVE_CACHE_KEY,
  buildWatchlistLiveCacheRow,
  fetchWatchlistLiveTickers,
  readFreshWatchlistLivePayload,
} from '../lib/market-analysis-watchlist-live.js';

type RequestLike = {
  method?: string;
};

type ResponseLike = {
  setHeader: (name: string, value: string) => void;
  status: (code: number) => ResponseLike;
  json: (body: unknown) => ResponseLike;
  end: () => void;
};

export default async function handler(req: RequestLike, res: ResponseLike) {
  Object.entries(watchlistCorsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const env = readWatchlistServerEnv(process.env);
    const admin = createWatchlistAdminClient(env);
    const now = new Date();

    const { data: cachedRow } = await admin
      .from('market_analysis_watchlist_live_cache')
      .select('cache_key, payload_json, fetched_at, expires_at, updated_at')
      .eq('cache_key', WATCHLIST_LIVE_CACHE_KEY)
      .maybeSingle();

    const cachedPayload = readFreshWatchlistLivePayload(cachedRow as any, now);
    if (cachedPayload) {
      res.status(200).json({ ok: true, cached: true, refreshedAt: cachedPayload.refreshedAt, items: cachedPayload.items });
      return;
    }

    const { data: watchlistRows, error: watchlistError } = await admin
      .from('market_analysis_watchlist')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (watchlistError) {
      throw watchlistError;
    }

    const watchlistItems = mapMarketAnalysisWatchlistRows((watchlistRows || []) as MarketAnalysisWatchlistRow[]);
    const liveItems = await fetchWatchlistLiveTickers(watchlistItems);
    const nextCacheRow = buildWatchlistLiveCacheRow(liveItems, now);

    await admin
      .from('market_analysis_watchlist_live_cache')
      .upsert(nextCacheRow, { onConflict: 'cache_key' });

    res.status(200).json({
      ok: true,
      cached: false,
      refreshedAt: nextCacheRow.payload_json.refreshedAt,
      items: nextCacheRow.payload_json.items,
    });
  } catch (error) {
    console.error('market-analysis-watchlist live error', error);
    res.status(500).json({ error: 'Failed to refresh watchlist live data.' });
  }
}
