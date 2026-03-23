import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

const readLocalEnv = () => {
  const envPath = resolve(process.cwd(), '.env.txt');
  if (!existsSync(envPath)) return {};

  return Object.fromEntries(
    readFileSync(envPath, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const [key, ...rest] = line.split('=');
        return [key, rest.join('=')];
      })
  );
};

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;
const localEnv = readLocalEnv();

export default defineConfig({
  testDir: './tests/visual',
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: externalBaseUrl || 'http://localhost:5173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: 'npm run dev -- --host 0.0.0.0 --port 5173',
        env: {
          ...process.env,
          ...localEnv
        },
        url: 'http://localhost:5173',
        reuseExistingServer: true,
        timeout: 120_000
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
