import { readdirSync } from "node:fs";

// Every page the browser tests visit. Notebook pages are found from
// src/content/notebooks/, so a new notebook is tested (and gets visual
// baselines) without editing this list.
export type PageCase = { name: string; path: string; status: number };

const notebooks = readdirSync(new URL("../../src/content/notebooks/", import.meta.url), { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

export const PAGES: PageCase[] = [
  { name: "home", path: "/", status: 200 },
  { name: "about", path: "/about/", status: 200 },
  { name: "notebooks", path: "/notebooks/", status: 200 },
  ...notebooks.map((slug) => ({ name: `notebook-${slug}`, path: `/notebooks/${slug}/`, status: 200 })),
  { name: "404", path: "/definitely-missing/", status: 404 },
];
