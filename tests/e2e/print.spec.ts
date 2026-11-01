import { expect, test } from "@playwright/test";

test("printed About shows where every external link goes, and hides the nav", async ({ page }) => {
  await page.emulateMedia({ media: "print" });
  await page.goto("/about/", { waitUntil: "networkidle" });
  await expect(page.locator(".site-nav")).toBeHidden();
  const afters = await page.locator('main a[href^="https://"]').evaluateAll((links) =>
    links.map((a) => ({ href: a.getAttribute("href"), after: getComputedStyle(a, "::after").content })),
  );
  expect(afters.length).toBeGreaterThan(0);
  for (const { href, after } of afters) {
    expect(after).toContain(href);
  }
});
