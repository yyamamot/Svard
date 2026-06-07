import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "test/e2e",
  fullyParallel: false,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4287",
    testIdAttribute: "data-review-id",
    trace: "on-first-retry",
  },
  webServer: {
    command: "pnpm exec vite preview --host 127.0.0.1 --port 4287 --strictPort",
    url: "http://127.0.0.1:4287",
    reuseExistingServer: false,
    timeout: 120000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 960 },
      },
    },
  ],
});
