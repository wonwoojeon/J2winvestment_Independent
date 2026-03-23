import test from 'node:test';
import assert from 'node:assert/strict';

import { shouldRefreshMarketAnalysisForAuthEvent } from '../../src/lib/marketAnalysisAuth.ts';

test('shouldRefreshMarketAnalysisForAuthEvent ignores initial and token refresh events', () => {
  assert.equal(shouldRefreshMarketAnalysisForAuthEvent('INITIAL_SESSION'), false);
  assert.equal(shouldRefreshMarketAnalysisForAuthEvent('TOKEN_REFRESHED'), false);
});

test('shouldRefreshMarketAnalysisForAuthEvent reacts to session changes that affect watchlist access', () => {
  assert.equal(shouldRefreshMarketAnalysisForAuthEvent('SIGNED_IN'), true);
  assert.equal(shouldRefreshMarketAnalysisForAuthEvent('SIGNED_OUT'), true);
  assert.equal(shouldRefreshMarketAnalysisForAuthEvent('USER_UPDATED'), true);
});
