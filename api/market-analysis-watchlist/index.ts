import {
  authenticateWatchlistAdminRequest,
  createWatchlistAdminClient,
  isWatchlistApiError,
  mapMarketAnalysisWatchlistRows,
  readWatchlistErrorMessage,
  readWatchlistServerEnv,
  readWatchlistViewer,
  toMarketAnalysisWatchlistRowInput,
  watchlistCorsHeaders,
} from '../_lib/market-analysis-watchlist';

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

const readRequestBody = (body: unknown) => (typeof body === 'string' ? JSON.parse(body) : body);

export default async function handler(req: RequestLike, res: ResponseLike) {
  Object.entries(watchlistCorsHeaders).forEach(([key, value]) => res.setHeader(key, value));

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const env = readWatchlistServerEnv(process.env);

  try {
    const admin = createWatchlistAdminClient(env);

    if (req.method === 'GET') {
      const viewer = await readWatchlistViewer(req.headers.authorization, env);
      const { data, error } = await admin
        .from('market_analysis_watchlist')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        throw error;
      }

      res.status(200).json({ ok: true, items: mapMarketAnalysisWatchlistRows(data || []), viewer });
      return;
    }

    const adminEmail = await authenticateWatchlistAdminRequest(req.headers.authorization, env);
    const row = toMarketAnalysisWatchlistRowInput(readRequestBody(req.body), adminEmail);

    const { data, error } = await admin
      .from('market_analysis_watchlist')
      .insert(row)
      .select('*')
      .single();

    if (error) {
      throw error;
    }

    res.status(201).json({ ok: true, item: mapMarketAnalysisWatchlistRows([data])[0] });
  } catch (error) {
    if (isWatchlistApiError(error)) {
      res.status(error.status).json({ error: readWatchlistErrorMessage(error) });
      return;
    }

    console.error('market-analysis-watchlist index error', error);
    res.status(500).json({ error: readWatchlistErrorMessage(error) });
  }
}
