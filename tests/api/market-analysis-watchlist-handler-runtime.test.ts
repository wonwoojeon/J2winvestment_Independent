import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

test('market analysis watchlist handlers can be imported by node esm runtime', () => {
  const result = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      "await import('./api/market-analysis-watchlist/index.ts'); await import('./api/market-analysis-watchlist/[id].ts');",
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
