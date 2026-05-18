import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config cho apps/web (e2e smoke).
 *
 * Mặc định KHÔNG tự start dev server — assume user/CI đã chạy `pnpm web:dev`
 * hoặc Playwright webServer config sẽ start (set qua env PLAYWRIGHT_WEB_SERVER=1).
 *
 * BASE_URL: chỉnh qua env BASE_URL nếu test trên reverse proxy
 * (vd: BASE_URL=https://lumi.nextgentra.com pnpm test:e2e).
 *
 * Phase 2: chỉ smoke test login page render. Sau khi có /me + dashboard
 * migrated, sẽ thêm full login → dashboard flow ở Phase 3+.
 */

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROME_PATH = process.env.PLAYWRIGHT_CHROME_PATH;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: CHROME_PATH ? { executablePath: CHROME_PATH } : undefined,
      },
    },
  ],
  webServer: process.env.PLAYWRIGHT_WEB_SERVER
    ? {
        command: 'pnpm dev',
        url: BASE_URL,
        timeout: 120_000,
        reuseExistingServer: !process.env.CI,
      }
    : undefined,
});
