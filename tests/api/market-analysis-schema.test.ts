import test from 'node:test';
import assert from 'node:assert/strict';

import { normalizeMarketAnalysisPayload } from '../../src/lib/marketAnalysis.ts';

test('normalizeMarketAnalysisPayload keeps enriched ticker fields', () => {
  const normalized = normalizeMarketAnalysisPayload({
    reportDate: '2026-03-23',
    marketScope: 'us',
    title: '미국 증시 데일리 분석',
    summary: '요약',
    tickers: [
      {
        symbol: 'tsla',
        name: ' Tesla ',
        stance: ' 관심 ',
        summary: ' 전기차 모멘텀 관찰 ',
        adminNote: ' 변동성 크니 분할 접근 ',
        price: 367.96,
        change: -23.24,
        changePercent: -5.94,
        currency: 'USD',
        sessionLabel: '장마감',
        commentary: '반등 시도보다 변동성 안정 여부를 먼저 확인해야 합니다.',
        refreshedAt: '2026-03-23T10:00:00.000Z',
        news: [
          {
            title: 'Tesla tests new chip capacity plan',
            url: 'https://example.com/tesla-chip',
            source: 'Yahoo Finance',
            publishedAt: '2026-03-23T09:30:00.000Z',
          },
        ],
      },
    ],
  });

  assert.equal(normalized.tickers[0].symbol, 'TSLA');
  assert.equal(normalized.tickers[0].name, 'Tesla');
  assert.equal(normalized.tickers[0].adminNote, '변동성 크니 분할 접근');
  assert.equal(normalized.tickers[0].price, 367.96);
  assert.equal(normalized.tickers[0].changePercent, -5.94);
  assert.equal(normalized.tickers[0].commentary, '반등 시도보다 변동성 안정 여부를 먼저 확인해야 합니다.');
  assert.equal(normalized.tickers[0].news?.length, 1);
  assert.equal(normalized.tickers[0].news?.[0].title, 'Tesla tests new chip capacity plan');
});
