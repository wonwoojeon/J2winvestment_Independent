import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  MarketAnalysisWatchlistInput,
  MarketAnalysisWatchlistItem,
  MarketAnalysisWatchlistRow,
  MarketAnalysisWatchlistViewer,
} from '../../src/types/marketAnalysis.ts';

export const watchlistCorsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

export type WatchlistServerEnv = {
  supabaseUrl?: string;
  supabaseServiceRoleKey?: string;
  adminEmails?: string;
};

export class WatchlistApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'WatchlistApiError';
    this.status = status;
  }
}

const createWatchlistDeleteParamsSchema = z.object({
  id: z.string().trim().uuid(),
});

const marketAnalysisWatchlistInputSchema = z.object({
  symbol: z.string().trim().min(1),
  name: z.string().trim().min(1).optional(),
  stance: z.string().trim().min(1).optional(),
  summary: z.string().trim().min(1).optional(),
  sortOrder: z.number().int().min(0).optional().default(100),
});

const normalizeServerWatchlistInput = (input: MarketAnalysisWatchlistInput | unknown) => {
  const parsed = marketAnalysisWatchlistInputSchema.parse(input);

  return {
    symbol: parsed.symbol.trim().toUpperCase(),
    name: parsed.name?.trim() || undefined,
    stance: parsed.stance?.trim() || undefined,
    summary: parsed.summary?.trim() || undefined,
    sortOrder: parsed.sortOrder,
  };
};

const mapServerWatchlistItem = (row: MarketAnalysisWatchlistRow): MarketAnalysisWatchlistItem => ({
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

const selectActiveServerWatchlist = (items: MarketAnalysisWatchlistItem[]) =>
  items
    .filter((item) => item.isActive)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) {
        return left.sortOrder - right.sortOrder;
      }

      return left.createdAt.localeCompare(right.createdAt);
    });

const readBearerToken = (authorizationHeader?: string | string[]) => {
  const header = Array.isArray(authorizationHeader) ? authorizationHeader[0] : authorizationHeader;
  if (!header || !header.startsWith('Bearer ')) {
    return null;
  }

  return header.slice('Bearer '.length).trim();
};

export const parseAdminEmails = (csv?: string) =>
  (csv || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

export const isAdminEmail = (email: string | null | undefined, csv?: string) => {
  if (!email) return false;
  return parseAdminEmails(csv).includes(email.trim().toLowerCase());
};

export const readWatchlistServerEnv = (env: NodeJS.ProcessEnv): WatchlistServerEnv => ({
  supabaseUrl: env.SUPABASE_URL || env.VITE_SUPABASE_URL,
  supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY,
  adminEmails: env.MARKET_ANALYSIS_ADMIN_EMAILS,
});

export const createWatchlistAdminClient = (env: WatchlistServerEnv) => {
  if (!env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new WatchlistApiError(500, 'Supabase server credentials are not configured.');
  }

  return createClient(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
};

export const resolveUserEmailFromToken = async (token: string, env: WatchlistServerEnv) => {
  const admin = createWatchlistAdminClient(env);
  const { data, error } = await admin.auth.getUser(token);

  if (error) {
    throw new WatchlistApiError(401, 'Unauthorized');
  }

  return data.user?.email?.toLowerCase() || null;
};

export const authenticateWatchlistAdminRequest = async (
  authorizationHeader: string | string[] | undefined,
  env: WatchlistServerEnv,
  resolveEmail: (token: string) => Promise<string | null> = (token) => resolveUserEmailFromToken(token, env),
) => {
  const token = readBearerToken(authorizationHeader);
  if (!token) {
    throw new WatchlistApiError(401, 'Unauthorized');
  }

  const email = await resolveEmail(token);
  if (!email) {
    throw new WatchlistApiError(401, 'Unauthorized');
  }

  if (!isAdminEmail(email, env.adminEmails)) {
    throw new WatchlistApiError(403, 'Forbidden');
  }

  return email;
};

export const readWatchlistViewer = async (
  authorizationHeader: string | string[] | undefined,
  env: WatchlistServerEnv,
  resolveEmail: (token: string) => Promise<string | null> = (token) => resolveUserEmailFromToken(token, env),
): Promise<MarketAnalysisWatchlistViewer> => {
  const token = readBearerToken(authorizationHeader);
  if (!token) {
    return { email: null, isAdmin: false };
  }

  try {
    const email = await resolveEmail(token);
    return {
      email,
      isAdmin: isAdminEmail(email, env.adminEmails),
    };
  } catch {
    return { email: null, isAdmin: false };
  }
};

export const toMarketAnalysisWatchlistRowInput = (payload: unknown, createdByEmail: string) => {
  const normalized = normalizeServerWatchlistInput(payload);

  return {
    symbol: normalized.symbol,
    name: normalized.name ?? null,
    stance: normalized.stance ?? null,
    summary: normalized.summary ?? null,
    sort_order: normalized.sortOrder,
    is_active: true,
    created_by_email: createdByEmail,
  };
};

export const mapMarketAnalysisWatchlistRows = (rows: MarketAnalysisWatchlistRow[]) =>
  selectActiveServerWatchlist(rows.map(mapServerWatchlistItem));

export const readDeleteWatchlistId = (value: string | string[] | undefined) => {
  const id = Array.isArray(value) ? value[0] : value;
  return createWatchlistDeleteParamsSchema.parse({ id }).id;
};

export const isWatchlistApiError = (error: unknown): error is WatchlistApiError => error instanceof WatchlistApiError;

export const readWatchlistErrorMessage = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return error.issues.map((issue) => issue.message).join(', ');
  }

  if (error instanceof WatchlistApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'Unknown error';
};
