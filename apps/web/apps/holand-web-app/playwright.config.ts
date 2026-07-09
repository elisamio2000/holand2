import { defineConfig, devices } from '@playwright/test';

/** Match check-and-run.ps1 default dev port (see -Port 3002). */
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002';

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  // Dev server is started separately (check-and-run.ps1). Set PLAYWRIGHT_BASE_URL if port differs.
});
