import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizeAssetLookupSymbol,
  selectHistoricalCloseOnOrBeforeDate,
  shouldAutoFetchAssetPrice,
} from '../../src/lib/assetPriceLookup.ts';

test('normalizeAssetLookupSymbol maps supported markets to stooq symbols', () => {
  assert.equal(normalizeAssetLookupSymbol('TSLA', 'us'), 'tsla.us');
  assert.equal(normalizeAssetLookupSymbol(' tsla ', 'us'), 'tsla.us');
  assert.equal(normalizeAssetLookupSymbol('BTC', 'crypto'), 'btcusd');
  assert.equal(normalizeAssetLookupSymbol('btc-usd', 'crypto'), 'btcusd');
  assert.equal(normalizeAssetLookupSymbol('005930', 'kr'), null);
});

test('selectHistoricalCloseOnOrBeforeDate falls back to the latest available prior trading day', () => {
  const rows = [
    { date: '2026-03-20', close: 215.12 },
    { date: '2026-03-23', close: 221.45 },
  ];

  assert.deepEqual(selectHistoricalCloseOnOrBeforeDate(rows, '2026-03-22'), {
    date: '2026-03-20',
    close: 215.12,
  });
  assert.deepEqual(selectHistoricalCloseOnOrBeforeDate(rows, '2026-03-23'), {
    date: '2026-03-23',
    close: 221.45,
  });
  assert.equal(selectHistoricalCloseOnOrBeforeDate(rows, '2026-03-19'), null);
});

test('shouldAutoFetchAssetPrice only fetches when the ticker changed or no price exists in a supported market', () => {
  assert.equal(
    shouldAutoFetchAssetPrice({
      market: 'us',
      previousSymbol: '',
      nextSymbol: 'TSLA',
      currentPrice: 0,
    }),
    true,
  );

  assert.equal(
    shouldAutoFetchAssetPrice({
      market: 'us',
      previousSymbol: 'AAPL',
      nextSymbol: 'TSLA',
      currentPrice: 210.15,
    }),
    true,
  );

  assert.equal(
    shouldAutoFetchAssetPrice({
      market: 'us',
      previousSymbol: 'TSLA',
      nextSymbol: 'TSLA',
      currentPrice: 210.15,
    }),
    false,
  );

  assert.equal(
    shouldAutoFetchAssetPrice({
      market: 'kr',
      previousSymbol: '',
      nextSymbol: '005930',
      currentPrice: 0,
    }),
    false,
  );
});
