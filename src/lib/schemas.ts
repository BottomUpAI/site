import { z } from "astro/zod";
import { hasMarker } from "./markers";

// A link target is a real https/mailto URL, or a [[WRITE: …]] marker for one
// Nathan hasn't supplied yet (the production gate catches those).
const href = z
  .string()
  .refine((value) => /^(https:\/\/|mailto:)\S+$/.test(value) || hasMarker(value), {
    message: "must be an https:// or mailto: URL, or a [[WRITE: …]] marker",
  });

const httpsUrl = z.string().regex(/^https:\/\/\S+$/, "must be an https:// URL");

export const linkSchema = z.object({
  label: z.enum(["GitHub", "LinkedIn", "Email", "Bluesky", "Substack", "Google Scholar"]),
  href,
});

export const timelineEntrySchema = z.object({
  // A year, or a year and month.
  date: z.string().regex(/^\d{4}(-(0[1-9]|1[0-2]))?$/, "must be YYYY or YYYY-MM"),
  // The title is the link (when there is one); the detail is plain text under it.
  title: z.string().min(1),
  href: httpsUrl.optional(),
  detail: z.string().min(1).optional(),
});

export const homeSchema = z.object({
  name: z.string().min(1),
  focus: z.string().min(1),
  description: z.string().min(1),
  links: z.array(linkSchema),
});

export const aboutSchema = z.object({
  description: z.string().min(1),
  resume: httpsUrl,
  timeline: z.array(timelineEntrySchema),
});

export type Link = z.infer<typeof linkSchema>;
export type TimelineEntry = z.infer<typeof timelineEntrySchema>;

// Notebooks: src/content/notebooks/<slug>/ holds the .ipynb (copied from
// BottomUpAI/notebooks by scripts/sync-notebook.sh) and this notebook.yaml.
export const notebookMetaSchema = z.object({
  // Meta description and the index-page blurb: Nathan's words (or a marker).
  description: z.string().min(1),
  // The notebook in BottomUpAI/notebooks.
  source: httpsUrl,
  // A licence file in the same directory, shown on the page, for notebooks
  // built on someone else's work.
  licence: z.string().regex(/^[\w.-]+$/, "must be a file name in the notebook's directory").optional(),
});

const notebookOutputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("text"), text: z.string(), stream: z.enum(["stdout", "stderr", "result", "error"]) }),
  z.object({ kind: z.literal("image"), file: z.string(), width: z.number().int(), height: z.number().int() }),
  z.object({ kind: z.literal("widget") }),
]);

// What the loader stores: the metadata, plus the notebook as rendered by src/lib/notebook.ts.
export const notebookSchema = notebookMetaSchema.omit({ licence: true }).extend({
  title: z.string().min(1),
  titleHtml: z.string().min(1),
  licenceText: z.string().optional(),
  cells: z.array(
    z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("markdown"), html: z.string() }),
      z.object({ kind: z.literal("code"), number: z.number().int(), html: z.string(), outputs: z.array(notebookOutputSchema) }),
    ]),
  ),
  images: z.array(z.object({ file: z.string(), base64: z.string() })),
});

export type NotebookMeta = z.infer<typeof notebookMetaSchema>;
