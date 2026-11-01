import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

test.use({ viewport: { width: 320, height: 640 } });

for (const { name, path } of PAGES) {
  test(`${name}: no horizontal scroll at 320px`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const { scrollWidth, clientWidth } = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
    }));
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

// Nathan's prose isn't written yet, so the real text may hold tokens the seed
// content doesn't: URLs, email addresses, long compound words. Inject them into
// every text element and check the page still fits.
const LONG_TOKENS =
  " https://arxiv.org/abs/2507.01413v2/supplementary/collusion-double-auction-traces " +
  "nathan.douglas.longer.address@bottomuplabs.ai " +
  "Rechtsschutzversicherungsgesellschaftenzusammenschluss ";

for (const { name, path } of PAGES) {
  test(`${name}: long URLs, emails and words wrap at 320px`, async ({ page }) => {
    await page.goto(path, { waitUntil: "networkidle" });
    const { scrollWidth, clientWidth } = await page.evaluate((tokens) => {
      // Not <time>: dates are schema-validated YYYY or YYYY-MM.
      for (const el of document.querySelectorAll("h1, h2, p, li, a, span, mark")) {
        el.append(document.createTextNode(tokens));
      }
      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
      };
    }, LONG_TOKENS);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth);
  });
}

// Dates in the timeline are short and must never break across lines.
for (const width of [320, 1280]) {
  test(`about: timeline dates stay on one line at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/about/", { waitUntil: "networkidle" });
    const lines = await page.locator(".timeline time").evaluateAll((times) =>
      // Count the text's line boxes: the element itself stretches to its grid row.
      times.map((t) => {
        const range = document.createRange();
        range.selectNodeContents(t);
        return new Set([...range.getClientRects()].map((r) => Math.round(r.top))).size;
      }),
    );
    expect(lines.length).toBeGreaterThan(0);
    expect(lines.every((n) => n === 1), JSON.stringify(lines)).toBe(true);
  });
}
