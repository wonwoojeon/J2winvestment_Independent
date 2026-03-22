import test from 'node:test';
import assert from 'node:assert/strict';

import { selectPreferredMarketAnalysisReports } from '../../src/lib/marketAnalysis.ts';
import type { MarketAnalysisReport } from '../../src/types/marketAnalysis.ts';

const makeReport = (id: string, marketScope: string, title: string): MarketAnalysisReport => ({
  id,
  reportDate: '2026-03-23',
  marketScope,
  title,
  summary: `${title} 요약`,
  highlights: [],
  tickers: [],
  sourceName: 'daily_stock_analysis',
  sourceUrl: null,
  rawPayload: {},
  createdAt: '2026-03-23T00:00:00.000Z',
  updatedAt: '2026-03-23T00:00:00.000Z'
});

test('selectPreferredMarketAnalysisReports keeps only US reports', () => {
  const reports = [
    makeReport('cn-1', 'cn', '중국 증시 데일리 분석'),
    makeReport('us-1', 'us', '미국 증시 데일리 분석'),
    makeReport('cn-2', 'cn', '중국 증시 마감 복기')
  ];

  assert.deepEqual(
    selectPreferredMarketAnalysisReports(reports).map((report) => report.id),
    ['us-1']
  );
});

test('selectPreferredMarketAnalysisReports returns empty when no US report exists', () => {
  const reports = [
    makeReport('cn-1', 'cn', '중국 증시 데일리 분석')
  ];

  assert.deepEqual(selectPreferredMarketAnalysisReports(reports), []);
});
