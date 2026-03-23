import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('market analysis watchlist server helpers do not depend on client runtime modules', () => {
  const source = readFileSync(new URL('../../api/_lib/market-analysis-watchlist.ts', import.meta.url), 'utf8');

  assert.equal(source.includes("../../src/lib/marketAnalysisWatchlist.ts"), false);
});
