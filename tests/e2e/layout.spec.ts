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
