import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: [['list'], ['html', { open: 'never', outputFolder: '../output/playwright/report' }]],
  outputDir: '../output/playwright/results',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'off', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm --prefix ../backend run test:e2e:server',
      url: 'http://127.0.0.1:4510/api/health',
      env: { NODE_ENV: 'test', MONGODB_URI: '', JWT_SECRET: 'synthetic-e2e-key-never-for-deployment', MONGOMS_RUNTIME_DOWNLOAD: 'false' },
      reuseExistingServer: false,
      timeout: 120_000,
    },
    {
      command: 'npm run preview -- --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173/login',
      env: { TECHBRIDGE_API_PROXY: 'http://127.0.0.1:4510' },
      reuseExistingServer: false,
    },
  ],
});
