import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

test('asset price handler compiles in a server-only context', () => {
  const result = spawnSync(
    'npx',
    [
      'tsc',
      'api/asset-price.ts',
      '--noEmit',
      '--module',
      'ESNext',
      '--target',
      'ES2022',
      '--moduleResolution',
      'bundler',
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

  assert.equal(result.status, 0, `stdout:
${result.stdout}
stderr:
${result.stderr}`);
});
