import { expect, test } from "@playwright/test";
import { PAGES } from "./pages";

// The server applies the exact production CSP, so anything the browser blocks
// here would be blocked on bottomuplabs.ai too.
for (const { name, path, status } of PAGES) {
  test(`${name}: no CSP violations and no scripts`, async ({ page }) => {
    const violations: string[] = [];
    page.on("console", (msg) => {
      if (/Content.Security.Policy/i.test(msg.text())) violations.push(msg.text());
    });
    await page.addInitScript(() => {
      document.addEventListener("securitypolicyviolation", (e) => {
        console.log(`Content-Security-Policy violation: ${e.violatedDirective} ${e.blockedURI}`);
      });
    });
    const res = await page.goto(path, { waitUntil: "networkidle" });
    expect(res?.status()).toBe(status);
    expect(violations).toEqual([]);
    await expect(page.locator("script")).toHaveCount(0);
  });
}
