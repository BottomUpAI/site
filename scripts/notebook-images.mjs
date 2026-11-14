#!/usr/bin/env node
// Prints the images a notebook's Markdown cells show from its own directory,
// one relative path per line: ![alt](images/x.webp) and <img src="x.svg">.
// Remote and absolute ones are skipped; the renderer rejects those.
//
//   node scripts/notebook-images.mjs <notebook.ipynb>
//
// sync-notebook.sh copies these in beside the notebook, and
// publish-notebook.sh checks they're committed and pushed.
import { readFileSync } from "node:fs";
import { posix } from "node:path";

const ipynb = process.argv[2];
if (!ipynb) {
  console.error("usage: node scripts/notebook-images.mjs <notebook.ipynb>");
  process.exit(2);
}

const notebook = JSON.parse(readFileSync(ipynb, "utf8"));
const paths = new Set();
for (const cell of notebook.cells ?? []) {
  if (cell.cell_type !== "markdown") continue;
  const source = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source);
  const refs = [
    ...[...source.matchAll(/!\[[^\]]*\]\(\s*<?([^)\s>]+)/g)].map((m) => m[1]),
    ...[...source.matchAll(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/gi)].map((m) => m[1]),
  ];
  for (const ref of refs) {
    const path = posix.normalize(decodeURI(ref));
    if (/^[a-z][a-z\d+.-]*:|^\/|^\.\.(\/|$)/i.test(path)) continue;
    paths.add(path);
  }
}
for (const path of [...paths].sort()) console.log(path);
