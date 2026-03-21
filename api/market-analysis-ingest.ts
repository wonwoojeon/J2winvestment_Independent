import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { isMarketAnalysisPayloadError, readMarketAnalysisErrorMessage, toMarketAnalysisRowInput } from '../src/lib/marketAnalysis';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type'
};

const readBearerToken = (authorizationHeader?: string | string[]) => {
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice('Bearer '.length).trim();
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
