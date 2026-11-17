// Playwright configuration of `pnpm e2e:smoke` (card P0-02.5): Chromium only, one worker, the smoke of e2e/.
// It starts `next dev` of apps/web on PORT (default 3000), or reuses the server already answering there.
import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.PORT ?? 3000);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: "e2e",
  outputDir: ".bridle/playwright",
  reporter: "list",
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  use: { baseURL },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm --filter web dev --hostname 127.0.0.1 --port ${port}`,
    url: `${baseURL}/api/v1/health`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
