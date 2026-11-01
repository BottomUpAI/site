#!/usr/bin/env node
// Fails the production build while any [[WRITE: …]] marker remains.
//
// Scans the built files as raw text, so markers in attributes and <head>
// (titles, meta descriptions, hrefs) count too, and so does an unterminated
// marker. Matching is case- and spacing-tolerant, like src/lib/markers.ts, so a
// mistyped [[write: …]] is caught too. Markdown percent-encodes link targets,
// so a marker used as a link URL arrives as %5B%5BWRITE: and is counted too.
//
//   node scripts/check-placeholders.mjs <dir> [--report]
//
// Exit 1 if any marker is found, 0 otherwise; with --report, always 0.
// Exit 2 if <dir> doesn't exist.
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";

const PLAIN = /\[\[\s*write\s*:/gi;
const ENCODED = /%5B%5B(?:%20|\s)*write(?:%20|\s)*(?::|%3A)/gi;
const SCANNED = /\.(html|xml|txt|svg|json|webmanifest|js|css)$/;

const [dir, flag] = process.argv.slice(2);
const reportOnly = flag === "--report";

if (!dir || !existsSync(dir)) {
  console.error(`check-placeholders: no such directory: ${dir}`);
  process.exit(2);
}

function* files(root) {
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) yield* files(path);
    else if (SCANNED.test(entry.name)) yield path;
  }
}

let total = 0;
for (const path of [...files(dir)].sort()) {
  const text = readFileSync(path, "utf8");
  const count = (text.match(PLAIN)?.length ?? 0) + (text.match(ENCODED)?.length ?? 0);
  if (count > 0) {
    console.log(`${relative(dir, path)}: ${count} marker(s)`);
    total += count;
  }
}
console.log(`total: ${total} marker(s)`);

process.exit(total > 0 && !reportOnly ? 1 : 0);
