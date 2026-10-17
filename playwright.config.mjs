import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node tools/dev-server.mjs',
    port: 4173,
    reuseExistingServer: false,
  },
  projects: [
    {
      name: 'pixel7',
      use: { ...devices['Pixel 7'], launchOptions: { executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' } },
    },
  ],
});
