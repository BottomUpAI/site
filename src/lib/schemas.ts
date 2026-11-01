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
  text: z.string().min(1),
  href: httpsUrl.optional(),
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
