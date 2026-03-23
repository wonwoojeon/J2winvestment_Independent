import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

test('market analysis watchlist handlers can be imported by node esm runtime', () => {
  const outDir = '.tmp-watchlist-runtime-test';

  const compile = spawnSync(
    'npx',
    [
      'tsc',
      'api/market-analysis-watchlist/index.ts',
      'api/market-analysis-watchlist/[id].ts',
      'api/lib/market-analysis-watchlist.ts',
      '--outDir',
      outDir,
      '--module',
      'NodeNext',
      '--target',
      'ES2022',
      '--moduleResolution',
      'nodenext',
      '--esModuleInterop',
      '--skipLibCheck',
      '--pretty',
      'false',
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  assert.equal(compile.status, 0, `compile stdout:\n${compile.stdout}\ncompile stderr:\n${compile.stderr}`);

  const result = spawnSync(
    'node',
    [
      '--input-type=module',
      '-e',
      `await import('./${outDir}/api/market-analysis-watchlist/index.js'); await import('./${outDir}/api/market-analysis-watchlist/[id].js');`,
    ],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    },
  );

  assert.equal(result.status, 0, `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`);
});
