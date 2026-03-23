import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWatchlistLiveCacheRow,
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
