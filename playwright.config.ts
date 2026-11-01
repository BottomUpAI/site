import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env["PORT"] ?? 4321);

export default defineConfig({
  testDir: "tests/e2e",
  forbidOnly: !!process.env["CI"],
  reporter: process.env["CI"] ? [["list"], ["html", { open: "never" }]] : "list",
  // Baselines are rendered in the Playwright container (see the CI workflow), so
  // the platform suffix is left out: one set of images, one environment.
  snapshotPathTemplate: "tests/e2e/__screenshots__/{arg}{ext}",
  use: {
    baseURL: `http://localhost:${PORT}`,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "node tests/serve.mjs",
    url: `http://localhost:${PORT}/`,
    reuseExistingServer: !process.env["CI"],
    env: { PORT: String(PORT) },
  },
});
