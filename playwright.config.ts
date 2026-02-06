import { defineConfig, devices } from '@playwright/test';

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

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
