// Lighthouse CI. Notebook pages are found from src/content/notebooks/, like the
// browser tests' page list (tests/e2e/pages.ts).
const { readdirSync } = require("node:fs");
const { join } = require("node:path");

const BASE = "http://localhost:4321";
const notebooks = readdirSync(join(__dirname, "src/content/notebooks"), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => `${BASE}/notebooks/${entry.name}/`)
  .sort();

module.exports = {
  ci: {
    collect: {
      startServerCommand: "node tests/serve.mjs",
      startServerReadyPattern: "serving dist/",
      url: [`${BASE}/`, `${BASE}/about/`, `${BASE}/notebooks/`, ...notebooks, `${BASE}/404.html`],
      numberOfRuns: 3,
      settings: { preset: "desktop" },
    },
    assert: {
      assertions: {
        "categories:performance": ["error", { minScore: 0.95 }],
        "categories:accessibility": ["error", { minScore: 1 }],
        "categories:best-practices": ["error", { minScore: 1 }],
        "categories:seo": ["error", { minScore: 1 }],
      },
    },
    upload: { target: "filesystem", outputDir: ".lighthouseci" },
  },
};
