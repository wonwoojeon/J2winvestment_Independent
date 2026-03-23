import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readHandlerSource = (relativePath: string) =>
  readFileSync(new URL(relativePath, import.meta.url), 'utf8');

test('market analysis watchlist handlers use js extensions for local helper imports', () => {
  const indexSource = readHandlerSource('../../api/market-analysis-watchlist/index.ts');
  const deleteSource = readHandlerSource('../../api/market-analysis-watchlist/[id].ts');

  assert.equal(indexSource.includes("../lib/market-analysis-watchlist.js"), true);
  assert.equal(deleteSource.includes("../lib/market-analysis-watchlist.js"), true);
});
