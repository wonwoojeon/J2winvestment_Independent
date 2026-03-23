export interface MarketAnalysisTicker {
  symbol: string;
  name?: string;
  stance?: string;
  summary?: string;
}

export interface MarketAnalysisWatchlistInput {
  symbol: string;
  name?: string;
  stance?: string;
  summary?: string;
  sortOrder?: number;
}

export interface MarketAnalysisWatchlistRow {
  id: string;
  symbol: string;
  name: string | null;
  stance: string | null;
  summary: string | null;
  sort_order: number;
  is_active: boolean;
  created_by_email: string | null;
  created_at: string;
  updated_at: string;
}

export interface MarketAnalysisWatchlistItem {
  id: string;
  symbol: string;
  name?: string;
  stance?: string;
  summary?: string;
  sortOrder: number;
  isActive: boolean;
  createdByEmail?: string;
  createdAt: string;
  updatedAt: string;
}

export interface MarketAnalysisWatchlistViewer {
  email: string | null;
  isAdmin: boolean;
}

export interface MarketAnalysisWatchlistResponse {
  ok: boolean;
  items: MarketAnalysisWatchlistItem[];
  viewer: MarketAnalysisWatchlistViewer;
}

export interface MarketAnalysisPayload {
  reportDate: string;
  marketScope?: string;
  title: string;
  summary: string;
  highlights?: string[];
  tickers?: MarketAnalysisTicker[];
  sourceName?: string;
  sourceUrl?: string;
  rawPayload?: Record<string, unknown>;
}

export interface MarketAnalysisReportRow {
  id: string;
  report_date: string;
  market_scope: string;
  title: string;
  summary: string;
  highlights: string[];
  tickers: MarketAnalysisTicker[];
  source_name: string;
  source_url: string | null;
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MarketAnalysisReport {
  id: string;
  reportDate: string;
  marketScope: string;
  title: string;
  summary: string;
  highlights: string[];
  tickers: MarketAnalysisTicker[];
  sourceName: string;
  sourceUrl: string | null;
  rawPayload: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}
