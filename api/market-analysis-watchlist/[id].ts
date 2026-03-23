import {
  authenticateWatchlistAdminRequest,
  createWatchlistAdminClient,
  isWatchlistApiError,
  readDeleteWatchlistId,
  readWatchlistErrorMessage,
  readWatchlistServerEnv,
  watchlistCorsHeaders,
} from '../_lib/market-analysis-watchlist.ts';

type RequestLike = {
  method?: string;
  headers: {
    authorization?: string | string[];
  };
  query: {
    id?: string | string[];
  };
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

  if (req.method !== 'DELETE') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const env = readWatchlistServerEnv(process.env);

  try {
    await authenticateWatchlistAdminRequest(req.headers.authorization, env);

    const id = readDeleteWatchlistId(req.query.id);
    const admin = createWatchlistAdminClient(env);
    const { error } = await admin.from('market_analysis_watchlist').delete().eq('id', id);

    if (error) {
      throw error;
    }

    res.status(200).json({ ok: true, id });
  } catch (error) {
    if (isWatchlistApiError(error)) {
      res.status(error.status).json({ error: readWatchlistErrorMessage(error) });
      return;
    }

    console.error('market-analysis-watchlist delete error', error);
    res.status(500).json({ error: readWatchlistErrorMessage(error) });
  }
}
