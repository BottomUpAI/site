import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { aboutSchema, homeSchema } from "./lib/schemas";

// Nathan's words for the Home and About pages. Each collection holds one file.
const home = defineCollection({
  loader: glob({ pattern: "home.md", base: "./src/content/pages" }),
  schema: homeSchema,
});

const about = defineCollection({
  loader: glob({ pattern: "about.md", base: "./src/content/pages" }),
  schema: aboutSchema,
});

export const collections = { home, about };
