import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";

// CloudFront serves /about (no slash) as /about/index.html, so a relative
// asset URL would resolve against / and break. Every reference must be
// root-absolute, absolute https, mailto, or a fragment.
const OK = /^(\/|https:\/\/|mailto:|#)/;
const ATTRS = /<(?:link|script|img|source)\b[^>]*?\s(?:href|src|srcset)="([^"]*)"/g;

function* htmlFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

test("every asset reference in dist is root-absolute", () => {
  const bad: string[] = [];
  for (const file of htmlFiles("dist")) {
    for (const [, url] of readFileSync(file, "utf8").matchAll(ATTRS)) {
      if (url !== undefined && !OK.test(url)) bad.push(`${file}: ${url}`);
    }
  }
  expect(bad).toEqual([]);
});
