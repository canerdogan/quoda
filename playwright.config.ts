import { defineConfig, devices } from "@playwright/test";

// E2E against a real wrangler dev server. The webServer block boots it (and
// builds tokens + islands first) and tears it down after the run.
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30_000,
  retries: 0,
  use: {
    baseURL: "http://localhost:8787",
    trace: "off",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build:tokens && npm run build:client && npx wrangler dev --port 8787",
    url: "http://localhost:8787/healthz",
    timeout: 60_000,
    reuseExistingServer: true,
    stdout: "ignore",
    stderr: "pipe",
  },
});
