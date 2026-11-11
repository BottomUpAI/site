import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

const ADDRESS = "hello@bottomuplabs.ai";

function* textFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* textFiles(path);
    else if (/\.(html|xml|txt|json|webmanifest|js|css|svg)$/.test(entry.name)) yield path;
  }
}

test("no built file contains the email address literally", () => {
  const found = [...textFiles("dist")].filter((file) => /[a-z0-9._%+-]+@bottomuplabs\.ai/i.test(readFileSync(file, "utf8")));
  expect(found).toEqual([]);
});

test("the home page still shows a working email link", async ({ page }) => {
  await page.goto("/");
  const link = page.locator('.link-row a[href^="mailto:"]');
  await expect(link).toHaveAttribute("href", `mailto:${ADDRESS}`);
  await expect(link).toHaveText(ADDRESS);
});
