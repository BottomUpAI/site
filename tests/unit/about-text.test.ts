import { expect, test } from "vitest";
import { aboutMarkdown, aboutPlain, plainText } from "../../src/lib/about-text";

const base = {
  name: "Nathan Douglas",
  url: "https://bottomuplabs.ai/about/",
  body: "First paragraph, with [a link](https://l.example).\n\n- **Inside a model:** *mech* interp, `code`.\n",
  resume: "https://x.example/resume.pdf",
  timeline: [
    { date: "2026-11", title: "Example", href: "https://example.org/", detail: "Example description" },
    { date: "2026-10", title: "Plain" },
  ],
};

test("Markdown: one line per entry, '- [Title](url) - detail', newest first as given", () => {
  const md = aboutMarkdown(base);
  expect(md).toContain("- [Example](https://example.org/) - Example description\n- Plain\n");
  expect(md).toContain("# Nathan Douglas\n\nhttps://bottomuplabs.ai/about/\n\nFirst paragraph, with [a link](https://l.example).");
  expect(md).toContain("- **Inside a model:** *mech* interp, `code`.");
  expect(md.trimEnd().endsWith("[Résumé (PDF)](https://x.example/resume.pdf)")).toBe(true);
});

test("plain text: '- Title (url) - detail', and no Markdown left in the body", () => {
  const txt = aboutPlain(base);
  expect(txt).toContain("- Example (https://example.org/) - Example description\n- Plain\n");
  expect(txt).toContain("Nathan Douglas\n\nhttps://bottomuplabs.ai/about/\n\nFirst paragraph, with a link (https://l.example).");
  expect(txt).toContain("- Inside a model: mech interp, code.");
  expect(txt).not.toMatch(/[*`#\[]/);
  expect(txt.trimEnd().endsWith("Résumé (PDF): https://x.example/resume.pdf")).toBe(true);
});

test("plainText leaves underscores and asterisks inside words alone", () => {
  expect(plainText("snake_case and 2*3*4")).toBe("snake_case and 2*3*4");
});
