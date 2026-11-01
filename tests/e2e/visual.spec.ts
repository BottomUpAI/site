import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

const VIEWPORTS = [
  { label: "desktop", width: 1280, height: 800 },
  { label: "phone", width: 375, height: 812 },
];

for (const colorScheme of ["light", "dark"] as const) {
  for (const viewport of VIEWPORTS) {
    test.describe(`${colorScheme} ${viewport.label}`, () => {
      test.use({ colorScheme, viewport: { width: viewport.width, height: viewport.height } });

      for (const { name, path } of PAGES) {
        test(`${name}`, async ({ page }) => {
          await page.goto(path, { waitUntil: "networkidle" });
          await page.evaluate(() => document.fonts.ready);
          await expect(page).toHaveScreenshot(`${name}-${colorScheme}-${viewport.label}.png`, {
            fullPage: true,
            maxDiffPixelRatio: 0.001,
          });
        });
      }
    });
  }
}
