import type { TimelineEntry } from "./schemas";

export interface AboutText {
  name: string;
  url: string;
  body: string;
  timeline: TimelineEntry[];
  resume: string;
}

// The About page for pasting into applications and forms, generated from the
// same content as /about/ so the site stays the one place it's written.
// Some boxes take Markdown and some only plain text, so there are two.

function entryMarkdown(e: TimelineEntry): string {
  const title = e.href ? `[${e.title}](${e.href})` : e.title;
  return `- ${e.date}: ${title}${e.detail ? ` - ${e.detail}` : ""}`;
}

function entryPlain(e: TimelineEntry): string {
  const title = e.href ? `${e.title} (${e.href})` : e.title;
  return `- ${e.date}: ${title}${e.detail ? ` - ${e.detail}` : ""}`;
}

// Enough Markdown-to-text for prose: links become "text (url)", and emphasis
// and code markers go. Lists and paragraphs read fine as they are.
export function plainText(markdown: string): string {
  return markdown
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, "$1 ($2)")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(?<![\w*])([*_])(?!\s)(.+?)(?<!\s)\1(?![\w*])/g, "$2")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^#{1,6}\s+/gm, "");
}

export function aboutMarkdown({ name, url, body, timeline, resume }: AboutText): string {
  return [
    `# ${name}`,
    url,
    body.trim(),
    "## Timeline",
    timeline.map(entryMarkdown).join("\n"),
    `[Résumé (PDF)](${resume})`,
  ].join("\n\n") + "\n";
}

export function aboutPlain({ name, url, body, timeline, resume }: AboutText): string {
  return [
    name,
    url,
    plainText(body.trim()),
    "Timeline",
    timeline.map(entryPlain).join("\n"),
    `Résumé (PDF): ${resume}`,
  ].join("\n\n") + "\n";
}
