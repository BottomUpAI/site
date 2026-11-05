import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { notebookLoader } from "./lib/notebook-loader";
import { aboutSchema, homeSchema, notebookSchema } from "./lib/schemas";

// Nathan's words for the Home and About pages. Each collection holds one file.
const home = defineCollection({
  loader: glob({ pattern: "home.md", base: "./src/content/pages" }),
  schema: homeSchema,
});

const about = defineCollection({
  loader: glob({ pattern: "about.md", base: "./src/content/pages" }),
  schema: aboutSchema,
});

// Jupyter notebooks, one directory each (see src/lib/notebook-loader.ts).
const notebooks = defineCollection({
  loader: notebookLoader({ base: "./src/content/notebooks" }),
  schema: notebookSchema,
});

export const collections = { home, about, notebooks };
