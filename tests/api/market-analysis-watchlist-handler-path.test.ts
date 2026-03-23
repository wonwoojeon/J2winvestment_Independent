import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readHandlerSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('market analysis watchlist handlers do not import helpers from underscore directories', () => {
  const indexSource = readHandlerSource('../../api/market-analysis-watchlist/index.ts');
  const deleteSource = readHandlerSource('../../api/market-analysis-watchlist/[id].ts');

  assert.equal(indexSource.includes("'../_lib/market-analysis-watchlist"), false);
  assert.equal(deleteSource.includes("'../_lib/market-analysis-watchlist"), false);
});
