import test from 'node:test';
import assert from 'node:assert/strict';

import {
  WatchlistApiError,
  authenticateWatchlistAdminRequest,
  isAdminEmail,
  mapMarketAnalysisWatchlistRows,
  readWatchlistViewer,
} from '../../api/lib/market-analysis-watchlist.ts';
import {
  normalizeMarketAnalysisWatchlistInput,
  readWatchlistSummary,
} from '../../src/lib/marketAnalysisWatchlist.ts';
import type { MarketAnalysisReport, MarketAnalysisWatchlistItem, MarketAnalysisWatchlistRow } from '../../src/types/marketAnalysis.ts';

const makeReport = (tickers = 2): MarketAnalysisReport => ({
  id: 'report-1',
  reportDate: '2026-03-23',
  marketScope: 'us',
  title: '미국 증시 데일리 분석',
  summary: '요약',
  highlights: [],
  tickers: Array.from({ length: tickers }, (_, index) => ({
    symbol: `RPT${index + 1}`,
    stance: '리포트',
  })),
  sourceName: 'daily_stock_analysis',
  sourceUrl: null,
  rawPayload: {},
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
});

const makeWatchlistItem = (symbol: string, sortOrder: number): MarketAnalysisWatchlistItem => ({
  id: symbol,
  symbol,
  sortOrder,
  isActive: true,
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z',
});

test('normalizeMarketAnalysisWatchlistInput uppercases symbol and trims text', () => {
  const normalized = normalizeMarketAnalysisWatchlistInput({
    symbol: ' nvda ',
    name: ' NVIDIA ',
    stance: ' 관심 ',
    summary: ' AI 수요 추적 ',
    sortOrder: 7,
  });

  assert.equal(normalized.symbol, 'NVDA');
  assert.equal(normalized.name, 'NVIDIA');
  assert.equal(normalized.stance, '관심');
  assert.equal(normalized.summary, 'AI 수요 추적');
  assert.equal(normalized.sortOrder, 7);
});

test('normalizeMarketAnalysisWatchlistInput applies default sort order', () => {
  const normalized = normalizeMarketAnalysisWatchlistInput({
    symbol: 'msft',
  });

  assert.equal(normalized.symbol, 'MSFT');
  assert.equal(normalized.sortOrder, 100);
});

test('isAdminEmail matches configured emails case-insensitively', () => {
  assert.equal(isAdminEmail('Admin@Example.com', 'admin@example.com,ops@example.com'), true);
  assert.equal(isAdminEmail('viewer@example.com', 'admin@example.com,ops@example.com'), false);
});

test('authenticateWatchlistAdminRequest rejects missing bearer token', async () => {
  await assert.rejects(
    () =>
      authenticateWatchlistAdminRequest(
        undefined,
        { adminEmails: 'admin@example.com' },
        async () => 'admin@example.com',
      ),
    (error: unknown) => error instanceof WatchlistApiError && error.status === 401,
  );
});

test('authenticateWatchlistAdminRequest rejects non-admin email', async () => {
  await assert.rejects(
    () =>
      authenticateWatchlistAdminRequest(
        'Bearer token-123',
        { adminEmails: 'admin@example.com' },
        async () => 'viewer@example.com',
      ),
    (error: unknown) => error instanceof WatchlistApiError && error.status === 403,
  );
});

test('authenticateWatchlistAdminRequest returns admin email when token is valid', async () => {
  const adminEmail = await authenticateWatchlistAdminRequest(
    'Bearer token-123',
    { adminEmails: 'admin@example.com' },
    async (token) => {
      assert.equal(token, 'token-123');
      return 'admin@example.com';
    },
  );

  assert.equal(adminEmail, 'admin@example.com');
});

test('readWatchlistViewer returns anonymous viewer without bearer token', async () => {
  const viewer = await readWatchlistViewer(undefined, { adminEmails: 'admin@example.com' });

  assert.deepEqual(viewer, {
    email: null,
    isAdmin: false,
  });
});

test('mapMarketAnalysisWatchlistRows keeps only active rows and sorts by order then created time', () => {
  const rows: MarketAnalysisWatchlistRow[] = [
    {
      id: 'watch-2',
      symbol: 'MSFT',
      name: 'Microsoft',
      stance: '중립',
      summary: null,
      sort_order: 20,
      is_active: true,
      created_by_email: 'admin@example.com',
      created_at: '2026-03-23T00:02:00.000Z',
      updated_at: '2026-03-23T00:02:00.000Z',
    },
    {
      id: 'watch-0',
      symbol: 'QQQ',
      name: null,
      stance: null,
      summary: null,
      sort_order: 10,
      is_active: false,
      created_by_email: 'admin@example.com',
      created_at: '2026-03-23T00:01:00.000Z',
      updated_at: '2026-03-23T00:01:00.000Z',
    },
    {
      id: 'watch-1',
      symbol: 'NVDA',
      name: 'NVIDIA',
      stance: '관심',
      summary: '핵심',
      sort_order: 20,
      is_active: true,
      created_by_email: 'admin@example.com',
      created_at: '2026-03-23T00:01:00.000Z',
      updated_at: '2026-03-23T00:01:00.000Z',
    },
  ];

  assert.deepEqual(
    mapMarketAnalysisWatchlistRows(rows),
    [
      {
        id: 'watch-1',
        symbol: 'NVDA',
        name: 'NVIDIA',
        stance: '관심',
        summary: '핵심',
        sortOrder: 20,
        isActive: true,
        createdByEmail: 'admin@example.com',
        createdAt: '2026-03-23T00:01:00.000Z',
        updatedAt: '2026-03-23T00:01:00.000Z',
      },
      {
        id: 'watch-2',
        symbol: 'MSFT',
        name: 'Microsoft',
        stance: '중립',
        summary: undefined,
        sortOrder: 20,
        isActive: true,
        createdByEmail: 'admin@example.com',
        createdAt: '2026-03-23T00:02:00.000Z',
        updatedAt: '2026-03-23T00:02:00.000Z',
      },
    ],
  );
});

test('readWatchlistSummary prefers persistent watchlist count over report tickers', () => {
  const summary = readWatchlistSummary(makeReport(2), [
    makeWatchlistItem('NVDA', 10),
    makeWatchlistItem('MSFT', 20),
    makeWatchlistItem('META', 30),
  ]);

  assert.equal(summary.countLabel, '3개');
  assert.equal(summary.detail, '관리자 watchlist 기준');
});

test('readWatchlistSummary falls back to report tickers when watchlist is empty', () => {
  const summary = readWatchlistSummary(makeReport(2), []);

  assert.equal(summary.countLabel, '2개');
  assert.equal(summary.detail, '오늘 리포트 기준');
});
