#!/usr/bin/env node
// Per-page byte budgets: each page's HTML plus everything it references
// (stylesheets, scripts, images, and the fonts those stylesheets reference).
// Sizes are uncompressed bytes on disk, so the real transfer is smaller.
//
//   node scripts/check-budgets.mjs <dir>
//
// Exits 1, printing a per-page table, if any page is over a budget.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const KB = 1024;
export const BUDGETS = {
  html: 30 * KB,
  css: 30 * KB,
  js: 0,
  fonts: 170 * KB,
  images: 100 * KB,
  total: 250 * KB,
};

const dir = process.argv[2];
if (!dir || !existsSync(dir)) {
  console.error(`check-budgets: no such directory: ${dir}`);
  process.exit(2);
}

function* htmlFiles(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* htmlFiles(path);
    else if (entry.name.endsWith(".html")) yield path;
  }
}

const size = (url) => {
  const file = join(dir, url.split(/[?#]/)[0]);
  return existsSync(file) ? statSync(file).size : 0;
};
const local = (url) => url.startsWith("/") && !url.startsWith("//");

function measure(htmlPath) {
  const html = readFileSync(htmlPath, "utf8");
  const sizes = { html: Buffer.byteLength(html), css: 0, js: 0, fonts: 0, images: 0 };
  const fonts = new Set();
  for (const [, url] of html.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="([^"]+)"/g)) {
    if (!local(url)) continue;
    sizes.css += size(url);
    const css = readFileSync(join(dir, url), "utf8");
    for (const [, font] of css.matchAll(/url\(["']?([^"')]+\.woff2)["']?\)/g)) fonts.add(font);
  }
  for (const font of fonts) sizes.fonts += size(font);
  for (const [, url] of html.matchAll(/<script\b[^>]*src="([^"]+)"/g)) if (local(url)) sizes.js += size(url);
  sizes.js += [...html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].reduce((n, m) => n + (m[1]?.length ?? 0), 0);
  for (const [, url] of html.matchAll(/<img\b[^>]*src="([^"]+)"/g)) if (local(url)) sizes.images += size(url);
  sizes.total = sizes.html + sizes.css + sizes.js + sizes.fonts + sizes.images;
  return sizes;
}

let over = false;
const rows = [];
for (const path of [...htmlFiles(dir)].sort()) {
  const sizes = measure(path);
  const failed = Object.keys(BUDGETS).filter((k) => sizes[k] > BUDGETS[k]);
  over ||= failed.length > 0;
  rows.push({
    page: relative(dir, path),
    ...Object.fromEntries(Object.entries(sizes).map(([k, v]) => [k, `${(v / KB).toFixed(1)}`])),
    over: failed.join(",") || "-",
  });
}
console.table(rows);
console.log(`budgets (KB): ${Object.entries(BUDGETS).map(([k, v]) => `${k} ${v / KB}`).join(", ")}`);
process.exit(over ? 1 : 0);
