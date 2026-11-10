import type { TimelineEntry } from "./schemas";

export interface AboutText {
  name: string;
  url: string;
  body: string;
  timeline: TimelineEntry[];
  resume: string;
}

// The About page as Markdown, for pasting into applications and forms.
// Same content as /about/, so the site stays the one place it's written.
export function aboutText({ name, url, body, timeline, resume }: AboutText): string {
  const entries = timeline.map((e) => {
    const title = e.href ? `[${e.title}](${e.href})` : e.title;
    const detail = e.detail ? `\n  ${e.detail}` : "";
    return `- ${e.date}: ${title}${detail}`;
  });
  return [
    `# ${name}`,
    url,
    body.trim(),
    "## Timeline",
    entries.join("\n"),
    `Résumé (PDF): ${resume}`,
  ].join("\n\n") + "\n";
}
