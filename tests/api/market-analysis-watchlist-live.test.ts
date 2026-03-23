import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWatchlistLiveCacheRow,
  fetchWatchlistLiveTickers,
  mergeWatchlistLiveSnapshots,
  readFreshWatchlistLivePayload,
} from '../../api/lib/market-analysis-watchlist-live.ts';
import type { MarketAnalysisTicker } from '../../src/types/marketAnalysis.ts';

test('watchlist live cache returns payload when still inside ttl window', () => {
  const row = buildWatchlistLiveCacheRow(
    [
      {
        symbol: 'TSLA',
        price: 367.96,
        changePercent: -5.94,
        refreshedAt: '2026-03-23T10:00:00.000Z',
      },
    ],
    new Date('2026-03-23T10:00:00.000Z'),
  );

  const payload = readFreshWatchlistLivePayload(row, new Date('2026-03-23T10:04:30.000Z'));

  assert.equal(payload?.items.length, 1);
  assert.equal(payload?.items[0].symbol, 'TSLA');
});

test('mergeWatchlistLiveSnapshots overlays live price and news but keeps commentary and admin note', () => {
  const baseTickers: MarketAnalysisTicker[] = [
    {
      symbol: 'TSLA',
      name: 'Tesla',
      stance: '관심',
      adminNote: '분할 접근',
      commentary: '변동성 안정이 먼저입니다.',
      summary: '기본 요약',
    },
  ];

  const merged = mergeWatchlistLiveSnapshots(baseTickers, [
    {
      symbol: 'TSLA',
      price: 367.96,
      change: -23.24,
      changePercent: -5.94,
      currency: 'USD',
      sessionLabel: '장중',
      refreshedAt: '2026-03-23T10:05:00.000Z',
      news: [
        {
          title: 'Tesla tests new chip capacity plan',
          url: 'https://example.com/tesla-chip',
        },
      ],
    },
  ]);

  assert.equal(merged[0].adminNote, '분할 접근');
  assert.equal(merged[0].commentary, '변동성 안정이 먼저입니다.');
  assert.equal(merged[0].price, 367.96);
  assert.equal(merged[0].changePercent, -5.94);
  assert.equal(merged[0].news?.[0].title, 'Tesla tests new chip capacity plan');
});


test('fetchWatchlistLiveTickers falls back to stooq quote snapshot when yahoo is throttled', async () => {
  const originalFetch = global.fetch;

  global.fetch = (async (input: string | URL | Request) => {
    const url = String(input);

    if (url.includes('query1.finance.yahoo.com')) {
      return {
        ok: false,
        status: 429,
        json: async () => ({ error: 'throttled' }),
      } as Response;
    }

    if (url.includes('stooq.com/q/d/l/')) {
      return {
        ok: true,
        text: async () => [
          'Date,Open,High,Low,Close,Volume',
          '2026-03-19,387.27,387.27,378.73,380.30,67078259',
          '2026-03-20,379.85,379.89,364.4601,367.96,78628603',
        ].join('\n'),
      } as Response;
    }

    throw new Error(`Unexpected fetch url: ${url}`);
  }) as typeof fetch;

  try {
    const items = await fetchWatchlistLiveTickers([
      {
        id: 'watch-1',
        symbol: 'TSLA',
        name: 'Tesla',
        stance: '관심',
        summary: '변동성 확인',
        sortOrder: 10,
        isActive: true,
        createdAt: '2026-03-23T10:00:00.000Z',
        updatedAt: '2026-03-23T10:00:00.000Z',
      },
    ]);

    assert.equal(items[0].symbol, 'TSLA');
    assert.equal(items[0].price, 367.96);
    assert.equal(items[0].change, -12.34);
    assert.equal(items[0].changePercent, -3.24);
    assert.equal(items[0].sessionLabel, '최근 종가');
  } finally {
    global.fetch = originalFetch;
  }
});
