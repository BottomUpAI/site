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
      for (const el of document.querySelectorAll("h1, h2, p, li, a, span, mark, time")) {
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
